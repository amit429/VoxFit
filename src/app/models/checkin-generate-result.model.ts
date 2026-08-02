import type { ProgressReviewRow } from '@/app/models/progress-review-row.model';
import type { PlanNudgeRow } from '@/app/models/plan-nudge-row.model';

/** What `generate-checkin` returns after its deterministic writes: the saved rows. */
export interface CheckinGenerateResult {
  review: ProgressReviewRow;
  nudge: PlanNudgeRow | null;
}
