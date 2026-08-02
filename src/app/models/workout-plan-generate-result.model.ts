import type { TrainingStatsSummary } from '@/app/models/training-stats-summary.model';
import type { WorkoutPlanContent } from '@/app/models/workout-plan-content.model';

/** Normalized result of a single generation, before it is persisted. */
export interface WorkoutPlanGenerateResult {
  plan: WorkoutPlanContent;
  aiRationale: string;
  statsSnapshot: TrainingStatsSummary;
}
