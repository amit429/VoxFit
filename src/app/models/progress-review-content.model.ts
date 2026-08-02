/** The AI review body stored in `progress_reviews.review` (JSONB, read back whole). */
export interface ProgressReviewContent {
  /** 1-3 short wins from the window (e.g. "You logged 4 sessions — your best in a month"). */
  highlights: string[];
  /** Observed directional trends, plain language, no clinical framing. */
  trends: string[];
  /** Gentle observational notes on repeated physical flags. Never assessive. */
  recurringNotes: string[];
  /** Forward, encouraging suggestions for next week. */
  suggestions: string[];
}
