export type DietMealTypeDb = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Row from `diet_logs` for list UI. */
export interface DietLogListRow {
  readonly id: string;
  /** Local calendar date `YYYY-MM-DD`. */
  readonly date: string;
  readonly meal_name: string;
  readonly meal_type: DietMealTypeDb | null;
  readonly calories: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  readonly prep_minutes: number | null;
  readonly rationale: string | null;
  readonly recipe_text: string | null;
  readonly created_at: string;
}

export interface MealSectionVm {
  readonly key: string;
  readonly label: string;
  readonly items: readonly DietLogListRow[];
  /** Unique per day+section for `@for` track in week view (outer `day` not allowed in `track`). */
  readonly trackId?: string;
}

export interface DayGroupVm {
  readonly dateKey: string;
  readonly dateHeading: string;
  readonly sections: readonly MealSectionVm[];
}
