/** One prescribed exercise inside a plan day. Reps is a string to allow ranges ("8-10"). */
export interface WorkoutPlanExercise {
  name: string;
  sets: number | null;
  reps: string | null;
  note: string | null;
}

export interface WorkoutPlanDay {
  day_label: string;
  focus: string;
  exercises: WorkoutPlanExercise[];
}

/** The structured plan body stored in `workout_plans.plan` (JSONB, read back whole). */
export interface WorkoutPlanContent {
  days: WorkoutPlanDay[];
}
