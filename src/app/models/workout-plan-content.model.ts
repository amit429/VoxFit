import type { WorkoutPlanAccommodation } from '@/app/models/workout-plan-accommodation.model';
import type { WorkoutPlanFocus } from '@/app/models/workout-plan-focus.model';
import type { WorkoutPlanNoteType } from '@/app/models/workout-plan-note-type.model';

/** One prescribed exercise inside a plan day. */
export interface WorkoutPlanExercise {
  name: string;
  /** Positive integer. Exercises without one are dropped during normalization. */
  sets: number;
  /** A string so ranges ("10–12") and durations ("30s") both fit. En-dashed on normalize. */
  rep_range: string | null;
  /** Free text, e.g. "~30 kg / dumbbell" or "bodyweight · to failure". Null renders no line. */
  start_load: string | null;
  note: string | null;
  note_type: WorkoutPlanNoteType | null;
}

export interface WorkoutPlanDay {
  /** 1-based position in the week. */
  day: number;
  /** e.g. "Upper Body". */
  title: string;
  /** e.g. "Push focus · chest, shoulders, triceps". */
  subtitle: string;
  focus: WorkoutPlanFocus;
  est_minutes: number | null;
  exercises: WorkoutPlanExercise[];
}

/**
 * The structured plan body stored in `workout_plans.plan` (JSONB, read back whole).
 *
 * Everything the My Plan screen renders lives here, including the plan-level
 * identity fields the hero card needs. Rows written before this shape existed
 * carry only `days[].day_label` / `focus` / `exercises[].reps`; they are upgraded
 * on read by `normalizeWorkoutPlanContent`, so nothing here needs to be optional.
 */
export interface WorkoutPlanContent {
  /** e.g. "5-Day Cut Split". */
  title: string;
  goal_label: string;
  sport_label: string;
  days_per_week: number;
  est_session_minutes: number | null;
  /** Headline reason, ≤180 chars by prompt — clamped in the UI regardless. */
  rationale_short: string;
  rationale_full: string;
  accommodations: WorkoutPlanAccommodation[];
  days: WorkoutPlanDay[];
}
