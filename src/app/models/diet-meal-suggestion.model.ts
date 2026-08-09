/** AI meal suggestion aligned with UI cards + DB `diet_logs`. */
export interface DietMealSuggestion {
  readonly name: string;
  /** Model-chosen glyph for the dish. Empty when it returned nothing usable. */
  readonly emoji: string;
  readonly prepMinutes: number;
  readonly calories: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  readonly rationale: string;
  readonly recipeSteps: readonly string[];
}
