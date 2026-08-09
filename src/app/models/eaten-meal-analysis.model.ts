/** A single already-eaten meal, nutrition-estimated by Gemini from a spoken description. */
export interface EatenMealAnalysis {
  readonly name: string;
  /** Model-chosen glyph for the dish. Empty when it returned nothing usable. */
  readonly emoji: string;
  readonly calories: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  /** One-line note on estimate/portion assumptions (not a craving rationale). */
  readonly rationale: string;
}
