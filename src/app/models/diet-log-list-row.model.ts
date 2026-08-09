import type { DietMealTypeDb } from '@/app/models/diet-meal-type-db.model';

/** Row from `diet_logs` for list UI. */
export interface DietLogListRow {
  readonly id: string;
  /** Local calendar date `YYYY-MM-DD`. */
  readonly date: string;
  readonly meal_name: string;
  readonly meal_type: DietMealTypeDb | null;
  /** Model-chosen glyph. Null on rows logged before the column existed. */
  readonly emoji: string | null;
  readonly calories: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  readonly prep_minutes: number | null;
  readonly rationale: string | null;
  readonly recipe_text: string | null;
  readonly created_at: string;
}
