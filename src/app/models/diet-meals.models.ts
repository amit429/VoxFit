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

/** A single already-eaten meal, nutrition-estimated by Gemini from a spoken description. */
export interface EatenMealAnalysis {
  readonly name: string;
  readonly calories: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  /** One-line note on estimate/portion assumptions (not a craving rationale). */
  readonly rationale: string;
}

export interface EatenMealAnalyzeResult {
  readonly meal: EatenMealAnalysis;
  /** Not persisted or displayed — used only to help the model settle on a clean name. */
  readonly cleanedTranscript: string;
}
