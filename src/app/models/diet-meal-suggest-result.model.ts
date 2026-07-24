import type { DietMealSuggestion } from '@/app/models/diet-meal-suggestion.model';

export interface DietMealSuggestResult {
  readonly meals: readonly DietMealSuggestion[];
  /**
   * De-duplicated/cleaned transcript from Gemini. Not persisted or displayed anywhere
   * today — kept on the response shape in case a future screen wants it.
   */
  readonly cleanedTranscript: string;
}
