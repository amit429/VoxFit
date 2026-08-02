import { Injectable, inject } from '@angular/core';
import { environment } from '@/environments/environment';
import { buildWorkoutPlanPrompt } from '@/app/prompts/generate-workout-plan.prompt';
import type {
  TrainingStatsSummary,
  WorkoutPlanContent,
  WorkoutPlanDay,
  WorkoutPlanExercise,
  WorkoutPlanGenerateResult,
} from '@/app/models';
import { SupabaseService } from '@/app/services/supabase.service';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

@Injectable({ providedIn: 'root' })
export class GeminiWorkoutPlanService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Edge path (prod): the agent gathers stats server-side, so no summary is needed —
   * the caller skips building one entirely. Direct path (local dev): single-shot call
   * that requires a client-built summary.
   */
  async generate(summaryForDirect?: TrainingStatsSummary): Promise<WorkoutPlanGenerateResult> {
    if (environment.useGeminiEdgeFunction) {
      return this.viaEdgeFunction();
    }
    return this.directGemini(summaryForDirect);
  }

  private async viaEdgeFunction(): Promise<WorkoutPlanGenerateResult> {
    const { data, error } = await this.supabase.client.functions.invoke('generate-workout-plan', {
      body: {},
    });
    if (error) {
      console.error('[GeminiWorkoutPlan] Edge function error', error);
      throw new Error(error.message || 'Plan generation failed');
    }
    if (data == null) throw new Error('Empty response from generate-workout-plan');
    if (typeof data === 'object' && 'error' in data) {
      throw new Error(String((data as { error: unknown }).error));
    }
    // The edge function returns { ai_rationale, plan, stats_snapshot } already-shaped.
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const snapshot = extractSnapshot(data);
    return parseWorkoutPlanJson(text, snapshot);
  }

  private async directGemini(summary?: TrainingStatsSummary): Promise<WorkoutPlanGenerateResult> {
    if (!summary) {
      throw new Error('Direct plan generation requires a stats summary');
    }
    const key = environment.geminiApiKey?.trim();
    if (!key) {
      throw new Error(
        'Missing geminiApiKey — add it in environment.dev.ts or enable useGeminiEdgeFunction with generate-workout-plan.',
      );
    }
    const { system, user } = buildWorkoutPlanPrompt(summary);
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('[GeminiWorkoutPlan] API error', res.status, errBody);
      throw new Error(`Gemini request failed (${res.status})`);
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const part = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!part) throw new Error('Empty Gemini response');
    return parseWorkoutPlanJson(part, summary);
  }
}

function extractSnapshot(data: unknown): TrainingStatsSummary {
  if (data && typeof data === 'object' && 'stats_snapshot' in data) {
    return (data as { stats_snapshot: TrainingStatsSummary }).stats_snapshot;
  }
  return {} as TrainingStatsSummary;
}

function stripJsonFence(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return t.trim();
}

export function parseWorkoutPlanJson(
  text: string,
  statsSnapshot: TrainingStatsSummary,
): WorkoutPlanGenerateResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch {
    throw new Error('Plan generator did not return valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid plan response');
  const o = parsed as Record<string, unknown>;

  const planRaw = o['plan'];
  const daysRaw = planRaw && typeof planRaw === 'object' ? (planRaw as Record<string, unknown>)['days'] : undefined;
  if (!Array.isArray(daysRaw)) throw new Error('Plan response missing days array');

  const days: WorkoutPlanDay[] = daysRaw.map((d, i) => parseDay(d, i)).filter((d): d is WorkoutPlanDay => d !== null);
  const plan: WorkoutPlanContent = { days };
  const aiRationale = String(o['ai_rationale'] ?? '').trim() || 'A plan built from your recent training.';

  return { plan, aiRationale, statsSnapshot };
}

function parseDay(raw: unknown, index: number): WorkoutPlanDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const exRaw = o['exercises'];
  const exercises: WorkoutPlanExercise[] = Array.isArray(exRaw)
    ? exRaw.map(parseExercise).filter((e): e is WorkoutPlanExercise => e !== null)
    : [];
  return {
    day_label: String(o['day_label'] ?? `Day ${index + 1}`).trim(),
    focus: String(o['focus'] ?? '').trim(),
    exercises,
  };
}

function parseExercise(raw: unknown): WorkoutPlanExercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = String(o['name'] ?? '').trim();
  if (!name) return null;
  const setsRaw = o['sets'];
  const setsNum = setsRaw == null ? NaN : Number(setsRaw);
  const note = String(o['note'] ?? '').trim();
  return {
    name,
    sets: Number.isFinite(setsNum) ? Math.max(0, Math.round(setsNum)) : null,
    reps: o['reps'] == null ? null : String(o['reps']).trim() || null,
    note: note || null,
  };
}
