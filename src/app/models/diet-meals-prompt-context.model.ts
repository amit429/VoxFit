/** Soft hints passed to the diet-meals suggestion prompt. */
export interface DietMealsPromptContext {
  readonly goal?: string | null;
  readonly targetCalories?: number | null;
  readonly targetProteinG?: number | null;
}
