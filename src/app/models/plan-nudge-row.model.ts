import type { PlanNudgeContent } from '@/app/models/plan-nudge-content.model';

export interface PlanNudgeRow {
  id: string;
  user_id: string;
  plan_id: string;
  created_at: string;
  period_start: string;
  period_end: string;
  generated_for_week: string;
  suggests_refresh: boolean;
  planned_sessions: number;
  completed_sessions: number;
  acknowledged_at: string | null;
  nudge: PlanNudgeContent;
}
