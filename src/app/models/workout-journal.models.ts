export interface HomeStreakMock {
  readonly days: number;
  readonly weekDots: readonly { readonly label: string; readonly completed: boolean }[];
}

export interface HomeWorkoutCardMock {
  readonly title: string;
  readonly subtitle: string;
  readonly statusLabel: string;
  readonly statusTone: 'success' | 'muted';
  readonly exerciseChips: readonly string[];
  readonly coachTitle: string;
  readonly coachNote: string;
}

export interface WorkoutSessionListMock {
  readonly id: string;
  readonly label: string;
  readonly dateLabel: string;
  /** `YYYY-MM-DD` for filtering (week range). */
  readonly dateKey: string;
  readonly exercises: number;
  readonly moodEmoji: string;
  readonly energyLabel: string;
  readonly hasFlag: boolean;
  readonly hasPr: boolean;
}

export interface WorkoutDetailMock {
  readonly title: string;
  readonly dateLabel: string;
  readonly moodEmoji: string;
  readonly moodLabel: string;
  readonly energyLabel: string;
  readonly volumeLabel: string;
  readonly coachNote: string;
  readonly exercises: readonly { readonly name: string; readonly detail: string; readonly pr: boolean }[];
  readonly flagsTitle: string;
  readonly flagsBody: string;
}

export interface WeeklyVolumeMock {
  readonly label: string;
  readonly values: readonly number[];
  readonly dayLabels: readonly string[];
}

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
  summary_line: string | null;
  set_lines: unknown;
}

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
  raw_transcript: string | null;
  exercises_logged: ExerciseLoggedRow[] | null;
}

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
