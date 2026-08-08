/**
 * Muscle vocabulary. Must match the `muscle_group` domain in migration 0007 —
 * the database rejects anything else, so a drift shows up as a failed write
 * rather than as bad data.
 */
export type MuscleGroupKey =
  | 'chest'
  | 'back'
  | 'legs'
  | 'glutes'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'other';

/** One muscle group's contribution in the current week. */
export interface MuscleWeekRow {
  readonly muscle: MuscleGroupKey;
  readonly volumeKg: number;
  /** Distinct sessions in the week that trained this group. */
  readonly sessions: number;
}

/** One muscle group's share of all-time strength volume. */
export interface MuscleShareRow {
  readonly muscle: MuscleGroupKey;
  readonly volumeKg: number;
  /** Percent of all-time strength tonnage. Cardio is excluded and reports 0. */
  readonly sharePct: number;
}

export interface MuscleBreakdown {
  readonly week: readonly MuscleWeekRow[];
  readonly overall: readonly MuscleShareRow[];
  readonly weekSessions: number;
  /**
   * Logged exercises still awaiting classification. Surfaced so the UI can say
   * so out loud instead of quietly under-reporting while the async classifier
   * is in flight.
   */
  readonly pending: number;
}
