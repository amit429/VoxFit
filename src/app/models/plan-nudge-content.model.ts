/** The AI nudge body stored in `plan_nudges.nudge` (JSONB, read back whole). */
export interface PlanNudgeContent {
  /** How to execute the current plan better this week. */
  executionNotes: string[];
  /** 1-3 specific focus points for the coming week. */
  focusThisWeek: string[];
  /** Why drift is happening, when it is; empty string when adherence is fine. */
  driftReason: string;
}
