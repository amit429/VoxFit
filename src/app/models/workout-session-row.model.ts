import type { ExerciseLoggedRow } from '@/app/models/exercise-logged-row.model';

/** Row from `workout_sessions`, joined with `exercises_logged`. */
export interface WorkoutSessionRow {
  id: string;
  user_id: string;
  date: string | null;
  session_label: string | null;
  ai_summary: string | null;
  mood: string | null;
  energy_level: string | null;
  physical_flags: string[] | null;
  created_at: string;
  exercises_logged: ExerciseLoggedRow[] | null;
}
