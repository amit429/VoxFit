import type { TrainingStatsSummary } from '@/app/models/training-stats-summary.model';
import type { WorkoutPlanContent } from '@/app/models/workout-plan-content.model';

export type WorkoutPlanStatus = 'active' | 'archived' | 'superseded';
export type WorkoutPlanSource = 'on_demand' | 'nudge_refresh';

export interface WorkoutPlanRow {
  id: string;
  user_id: string;
  created_at: string;
  status: WorkoutPlanStatus;
  start_date: string;
  end_date: string;
  source: WorkoutPlanSource;
  ai_rationale: string | null;
  plan: WorkoutPlanContent;
  stats_snapshot: TrainingStatsSummary;
}
