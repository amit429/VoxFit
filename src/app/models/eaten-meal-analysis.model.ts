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
