import type { ExerciseLoggedListRow } from '@/app/models/exercise-logged-list-row.model';

/** Lean session shape for "All"/"PRs" pagination — omits set_lines, ai_summary. */
export interface WorkoutSessionListRow {
  id: string;
  date: string | null;
  session_label: string | null;
  mood: string | null;
  energy_level: string | null;
  physical_flags: string[] | null;
  created_at: string;
  exercises_logged: ExerciseLoggedListRow[] | null;
}
