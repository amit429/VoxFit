import { Injectable, inject } from '@angular/core';
import { environment } from '@/environments/environment';
import { buildWorkoutExtractPrompt } from '@/app/prompts/workout-extract.prompt';
import type {
  ExerciseTypeDb,
  MoodDb,
  EnergyDb,
  WorkoutExerciseExtract,
  WorkoutExtractResult,
  WorkoutSetLineExtract,
} from '@/app/models/workout-extract.models';
import { SupabaseService } from '@/app/services/supabase.service';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

@Injectable({ providedIn: 'root' })
export class GeminiWorkoutExtractService {
  private readonly supabase = inject(SupabaseService);

  async extractFromTranscript(transcript: string): Promise<WorkoutExtractResult> {
    const text = transcript.trim();
    if (!text) {
      throw new Error('No transcript to analyze.');
    }
    const rawJson =
      environment.useGeminiEdgeFunction ? await this.extractViaEdgeFunction(text) : await this.extractDirect(text);
    return parseWorkoutExtractJson(rawJson);
  }

  private async extractDirect(transcript: string): Promise<string> {
    const key = environment.geminiApiKey?.trim();
    if (!key) {
      throw new Error('Missing geminiApiKey — add it in environment.dev.ts or use useGeminiEdgeFunction with an Edge Function + GEMINI_API_KEY secret.');
    }
    const { system, user } = buildWorkoutExtractPrompt(transcript);
    const url = `${GEMINI_URL}?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.25,
        },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('[GeminiWorkoutExtract] API error', res.status, errBody);
      throw new Error(`Gemini request failed (${res.status})`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const part = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!part) {
      throw new Error('Empty Gemini response');
    }
    return stripJsonFence(part);
  }

  private async extractViaEdgeFunction(transcript: string): Promise<string> {
    const { data, error } = await this.supabase.client.functions.invoke('extract-workout', {
      body: { transcript },
    });
    if (error) {
      console.error('[GeminiWorkoutExtract] Edge function error', error);
      throw new Error(error.message || 'Edge function failed');
    }
    if (data == null) {
      throw new Error('Empty response from extract-workout');
    }
    if (typeof data === 'object' && data !== null && 'error' in data) {
      throw new Error(String((data as { error: unknown }).error));
    }
    return typeof data === 'string' ? stripJsonFence(data) : JSON.stringify(data);
  }
}

function stripJsonFence(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return t.trim();
}

function parseWorkoutExtractJson(text: string): WorkoutExtractResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Model did not return valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid extract shape');
  }
  const o = parsed as Record<string, unknown>;
  const session_title = String(o['session_title'] ?? 'Workout').trim();
  const coach_summary = String(o['coach_summary'] ?? '').trim();
  const mood = normalizeMood(o['mood']);
  const energy_level = normalizeEnergy(o['energy_level']);
  const physical_flags = normalizeStringArray(o['physical_flags']);
  const exercisesRaw = o['exercises'];
  if (!Array.isArray(exercisesRaw)) {
    throw new Error('Missing exercises array');
  }
  const exercises: WorkoutExerciseExtract[] = exercisesRaw.map((ex, i) => parseExercise(ex, i));
  if (exercises.length === 0) {
    throw new Error('No exercises extracted — try adding more detail');
  }
  return {
    session_title,
    coach_summary,
    mood,
    energy_level,
    physical_flags,
    exercises,
  };
}

function normalizeMood(v: unknown): MoodDb {
  const s = String(v ?? '').toLowerCase();
  if (s === 'positive' || s === 'neutral' || s === 'negative') {
    return s;
  }
  return 'neutral';
}

function normalizeEnergy(v: unknown): EnergyDb {
  const s = String(v ?? '').toLowerCase();
  if (s === 'high' || s === 'medium' || s === 'low') {
    return s;
  }
  return 'medium';
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) {
    return [];
  }
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function parseSetLine(raw: unknown, exerciseIndex: number, lineIndex: number): WorkoutSetLineExtract {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid set_line at exercise ${exerciseIndex}, line ${lineIndex}`);
  }
  const s = raw as Record<string, unknown>;
  let sets = nullableInt(s['sets']);
  if (sets == null || sets < 1) {
    sets = 1;
  }
  return {
    sets,
    weight_kg: nullableNum(s['weight_kg']),
    reps: nullableInt(s['reps']),
    reps_min: nullableInt(s['reps_min']),
    reps_max: nullableInt(s['reps_max']),
    duration_secs: nullableInt(s['duration_secs']),
    distance_km: nullableNum(s['distance_km']),
    segment_label: normalizeSegmentLabel(s['segment_label']),
  };
}

function parseExercise(ex: unknown, index: number): WorkoutExerciseExtract {
  if (!ex || typeof ex !== 'object') {
    throw new Error(`Invalid exercise at index ${index}`);
  }
  const e = ex as Record<string, unknown>;
  const name = String(e['name'] ?? `Exercise ${index + 1}`).trim();
  const exercise_type = normalizeExerciseType(e['exercise_type']);
  const is_pr = Boolean(e['is_pr']);
  const setLinesRaw = e['set_lines'];

  if (Array.isArray(setLinesRaw) && setLinesRaw.length > 0) {
    const set_lines = setLinesRaw.map((sl, i) => parseSetLine(sl, index, i));
    const summary_line =
      String(e['summary_line'] ?? '').trim() || buildSummaryFromSetLines(exercise_type, set_lines);
    return { name, exercise_type, is_pr, summary_line, set_lines };
  }

  /* Legacy flat shape → single set_line */
  let sets = nullableInt(e['sets']);
  if (sets == null || sets < 1) {
    sets = 1;
  }
  const legacyLine: WorkoutSetLineExtract = {
    sets,
    weight_kg: nullableNum(e['weight_kg']),
    reps: nullableInt(e['reps']),
    reps_min: nullableInt(e['reps_min']),
    reps_max: nullableInt(e['reps_max']),
    duration_secs: nullableInt(e['duration_secs']),
    distance_km: nullableNum(e['distance_km']),
    segment_label: normalizeSegmentLabel(e['segment_label']),
  };
  const set_lines = [legacyLine];
  const summary_line =
    String(e['summary_line'] ?? '').trim() || buildSummaryFromSetLines(exercise_type, set_lines);
  return { name, exercise_type, is_pr, summary_line, set_lines };
}

function buildSummaryFromSetLines(type: ExerciseTypeDb, lines: readonly WorkoutSetLineExtract[]): string {
  return lines.map((l) => formatOneSetLine(type, l)).join(' · ');
}

function formatOneSetLine(type: ExerciseTypeDb, l: WorkoutSetLineExtract): string {
  if (type === 'cardio') {
    const label = l.segment_label?.trim();
    const prefix = label ? `${label} ` : '';
    const p: string[] = [];
    if (l.duration_secs != null && l.duration_secs > 0) {
      p.push(`${Math.round(l.duration_secs / 60)} min`);
    }
    if (l.distance_km != null && l.distance_km > 0) {
      p.push(`${l.distance_km} km`);
    }
    if (l.sets > 1) {
      p.unshift(`${l.sets}×`);
    }
    const body = p.join(' ').trim() || 'Cardio';
    return `${prefix}${body}`.trim();
  }
  const rep = formatRepRange(l);
  const w = l.weight_kg != null ? ` @ ${l.weight_kg} kg` : '';
  const setPrefix = l.sets > 1 ? `${l.sets}×` : '1×';
  return `${setPrefix}${rep}${w}`;
}

function formatRepRange(l: WorkoutSetLineExtract): string {
  if (l.reps_min != null && l.reps_max != null) {
    return `${l.reps_min}–${l.reps_max}`;
  }
  if (l.reps != null) {
    return String(l.reps);
  }
  return '?';
}

function normalizeExerciseType(v: unknown): ExerciseTypeDb {
  const s = String(v ?? '').toLowerCase();
  if (s === 'cardio') {
    return 'cardio';
  }
  return 'strength';
}

function nullableInt(v: unknown): number | null {
  if (v == null || v === '') {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function nullableNum(v: unknown): number | null {
  if (v == null || v === '') {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeSegmentLabel(v: unknown): string | null {
  if (v == null || v === '') {
    return null;
  }
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}
