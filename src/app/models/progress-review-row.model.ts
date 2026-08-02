import type { ProgressReviewContent } from '@/app/models/progress-review-content.model';
import type { TrainingStatsSummary } from '@/app/models/training-stats-summary.model';

export type HeadlineTone = 'positive' | 'neutral' | 'attention';

export interface ProgressReviewRow {
  id: string;
  user_id: string;
  created_at: string;
  period_start: string;
  period_end: string;
  generated_for_week: string;
  headline_tone: HeadlineTone;
  acknowledged_at: string | null;
  review: ProgressReviewContent;
  stats_snapshot: TrainingStatsSummary;
}
