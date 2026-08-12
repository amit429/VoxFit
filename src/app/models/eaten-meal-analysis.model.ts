import type { DietMealTypeDb } from '@/app/models/diet-meal-type-db.model';

/** A single already-eaten meal, nutrition-estimated by Gemini from a spoken description. */
export interface EatenMealAnalysis {
  readonly name: string;
  /** Model-chosen glyph for the dish. Empty when it returned nothing usable. */
  readonly emoji: string;
  readonly calories: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  /** One-line note on estimate/portion assumptions (not a craving rationale). */
  readonly rationale: string;
  /**
   * The model's classification — an explicit mention in the transcript ("for breakfast…")
   * wins, otherwise the local time the meal was logged, per the same bands `inferMealType()`
   * uses client-side. Null only if the model omitted/malformed it; the caller falls back to
   * `inferMealType()` in that case.
   */
  readonly mealType: DietMealTypeDb | null;
}
