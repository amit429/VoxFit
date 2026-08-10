/**
 * How an exercise note should be presented. `caution` is a physical flag the
 * plan worked around (rose, observational — never an alert red); `tip` is
 * ordinary coaching detail (neutral glass). Absent means render no note block.
 */
export type WorkoutPlanNoteType = 'caution' | 'tip';
