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
   * De-duplicated/cleaned transcript from Gemini — saved as `diet_logs.raw_transcript`
   * instead of the raw (often triplicated) mobile browser transcript.
   */
  readonly cleanedTranscript: string;
}
