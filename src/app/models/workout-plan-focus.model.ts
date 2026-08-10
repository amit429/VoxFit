/**
 * The training emphasis of a plan day. This is a closed enum rather than free
 * text because the UI keys colour off it — the day card's left rail, its number
 * tile, and its slice of the weekly focus bar all come from this value, so a
 * novel string from the model would render as an uncoloured day.
 */
export type WorkoutPlanFocus = 'push' | 'pull' | 'legs' | 'full' | 'cardio' | 'recovery';

/** Canonical order — used for the focus-bar legend so it never reshuffles between plans. */
export const WORKOUT_PLAN_FOCUSES: readonly WorkoutPlanFocus[] = [
  'push',
  'pull',
  'legs',
  'full',
  'cardio',
  'recovery',
];

/** Legend/subtitle label for a focus. */
export const WORKOUT_PLAN_FOCUS_LABELS: Readonly<Record<WorkoutPlanFocus, string>> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  full: 'Full',
  cardio: 'Cardio',
  recovery: 'Recovery',
};
