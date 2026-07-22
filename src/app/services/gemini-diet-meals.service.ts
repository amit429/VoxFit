import { Injectable, inject } from '@angular/core';
import { environment } from '@/environments/environment';
import { buildDietMealsPrompt, type DietMealsPromptContext } from '@/app/prompts/diet-meals.prompt';
import type { DietMealSuggestion, DietMealSuggestResult } from '@/app/models/diet-meals.models';
import { SupabaseService } from '@/app/services/supabase.service';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

@Injectable({ providedIn: 'root' })
export class GeminiDietMealsService {
  private readonly supabase = inject(SupabaseService);

  async suggestFromTranscript(transcript: string, ctx?: DietMealsPromptContext): Promise<DietMealSuggestResult> {
    const text = transcript.trim();
    if (!text) {
      throw new Error('Nothing heard — try speaking again.');
    }
    const rawJson =
      environment.useGeminiEdgeFunction ?
        await this.viaEdgeFunction(text, ctx)
      : await this.directGemini(text, ctx);
    return parseDietMealsJson(rawJson);
  }

  private async directGemini(transcript: string, ctx?: DietMealsPromptContext): Promise<string> {
    const key = environment.geminiApiKey?.trim();
    if (!key) {
      throw new Error(
        'Missing geminiApiKey — add it in environment.dev.ts or enable useGeminiEdgeFunction with suggest-diet-meals.',
      );
    }
    const { system, user } = buildDietMealsPrompt(transcript, ctx);
    const url = `${GEMINI_URL}?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.35,
        },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('[GeminiDietMeals] API error', res.status, errBody);
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

  private async viaEdgeFunction(transcript: string, ctx?: DietMealsPromptContext): Promise<string> {
    const body: Record<string, unknown> = { transcript };
    if (ctx?.goal) body['goal'] = ctx.goal;
    if (ctx?.targetCalories != null) body['target_calories'] = ctx.targetCalories;
    if (ctx?.targetProteinG != null) body['target_protein_g'] = ctx.targetProteinG;

    const { data, error } = await this.supabase.client.functions.invoke('suggest-diet-meals', { body });
    if (error) {
      console.error('[GeminiDietMeals] Edge function error', error);
      throw new Error(error.message || 'Edge function failed');
    }
    if (data == null) {
      throw new Error('Empty response from suggest-diet-meals');
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

function parseDietMealsJson(text: string): DietMealSuggestResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Meal planner did not return valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid meal response');
  }
  const o = parsed as Record<string, unknown>;
  const mealsRaw = o['meals'];
  if (!Array.isArray(mealsRaw)) {
    throw new Error('Missing meals array');
  }
  const meals = mealsRaw.map((m, i) => parseMeal(m, i)).filter(Boolean) as DietMealSuggestion[];
  if (meals.length < 5) {
    throw new Error('Too few meal suggestions — try adding more ingredients or cravings.');
  }
  const cleanedTranscript = String(o['cleaned_transcript'] ?? '').trim();
  return { meals: meals.slice(0, 6), cleanedTranscript };
}

function parseMeal(raw: unknown, index: number): DietMealSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = String(o['name'] ?? `Meal ${index + 1}`).trim();
  const prepMinutes = Math.max(5, Math.round(num(o['prep_minutes']) ?? 20));
  const calories = Math.max(0, Math.round(num(o['calories']) ?? 0));
  const proteinG = Math.max(0, num(o['protein_g']) ?? 0);
  const carbsG = Math.max(0, num(o['carbs_g']) ?? 0);
  const fatG = Math.max(0, num(o['fat_g']) ?? 0);
  const rationale = String(o['rationale'] ?? '').trim() || 'Balanced option from what you described.';
  const stepsRaw = o['recipe_steps'];
  const recipeSteps =
    Array.isArray(stepsRaw) ?
      stepsRaw.map((s) => String(s).trim()).filter(Boolean)
    : [];

  return {
    name,
    prepMinutes,
    calories,
    proteinG,
    carbsG,
    fatG,
    rationale,
    recipeSteps: recipeSteps.length > 0 ? recipeSteps : ['Combine prepared ingredients and serve warm.'],
  };
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
