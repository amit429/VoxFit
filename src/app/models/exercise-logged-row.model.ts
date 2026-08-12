import type { PrSource } from '@/app/models/pr-source.model';

/** Row from `exercises_logged`, joined onto a workout session. */
export interface ExerciseLoggedRow {
  id: string;
  session_id: string;
  exercise_name: string;
  exercise_type: 'strength' | 'cardio' | null;
  sets: number | null;
  reps: number | null;
  weight_kg: number | string | null;
  duration_secs: number | null;
  distance_km: number | string | null;
  is_pr: boolean | null;
  pr_source: PrSource;
  summary_line: string | null;
  set_lines: unknown;
}
