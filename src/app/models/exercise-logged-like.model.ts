/** Structural subset of `ExerciseLoggedRow` accepted by the legacy-row → extract mapper. */
export interface ExerciseLoggedLike {
  exercise_name: string;
  exercise_type: 'strength' | 'cardio' | null;
  sets: number | null;
  reps: number | null;
  weight_kg: number | string | null;
  duration_secs: number | null;
  distance_km: number | string | null;
  is_pr: boolean | null;
  summary_line: string | null;
  set_lines: unknown;
}
