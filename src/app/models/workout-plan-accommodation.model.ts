/**
 * One physical flag the plan was built around, kept structured rather than
 * buried in the rationale prose so the UI can surface it as a callout.
 */
export interface WorkoutPlanAccommodation {
  /** e.g. "Left shoulder discomfort". */
  reason: string;
  /** How many exercises were swapped or capped because of it. */
  affected_count: number;
}
