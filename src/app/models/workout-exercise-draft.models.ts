import type { ExerciseTypeDb } from '@/app/models/workout-extract.models';

/** Mutable row for the exercise editor form. */
export interface ExerciseSetLineDraft {
  sets: string;
  weight_kg: string;
  /** Strength: single rep count or range "10-12" / "10–12". */
  reps: string;
  /** Cardio: minutes (decimal ok). */
  duration_mins: string;
  distance_km: string;
  segment_label: string;
}

export interface ExerciseEditorFormModel {
  name: string;
  exercise_type: ExerciseTypeDb;
  is_pr: boolean;
  setLines: ExerciseSetLineDraft[];
}
