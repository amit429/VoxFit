import type { EatenMealAnalysis } from '@/app/models/eaten-meal-analysis.model';

export interface EatenMealAnalyzeResult {
  readonly meal: EatenMealAnalysis;
  /** Not persisted or displayed — used only to help the model settle on a clean name. */
  readonly cleanedTranscript: string;
}
