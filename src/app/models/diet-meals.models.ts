/** AI meal suggestion aligned with UI cards + DB `diet_logs`. */
export interface DietMealSuggestion {
  readonly name: string;
  readonly prepMinutes: number;
  readonly calories: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  readonly rationale: string;
  readonly recipeSteps: readonly string[];
}

export interface DietMealSuggestResult {
  readonly meals: readonly DietMealSuggestion[];
  /**
   * De-duplicated/cleaned transcript from Gemini. Not persisted or displayed anywhere
   * today — kept on the response shape in case a future screen wants it.
   */
  readonly cleanedTranscript: string;
}
