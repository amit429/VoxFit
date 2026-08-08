/** Which count a badge is awarded against. Mirrors `badge_definitions.metric`. */
export type BadgeMetric = 'streak' | 'workouts' | 'prs';

/**
 * One badge definition joined with whether this user has earned it.
 *
 * Thresholds come from the database — `badge_definitions` is the awarding
 * authority — so the client can show progress toward a locked badge without
 * duplicating the rule that grants it.
 */
export interface BadgeProgressRow {
  readonly badge_key: string;
  readonly metric: BadgeMetric;
  readonly threshold: number;
  /** ISO timestamp when awarded, or null while still locked. */
  readonly earned_at: string | null;
}

/**
 * Everything the badge shelf and the all-time stat tiles need, from one RPC.
 *
 * Replaces two count-only round trips plus client-side badge evaluation. The
 * same call awards anything newly earned, so reading is what persists a badge.
 */
export interface UserProgressStats {
  readonly workouts: number;
  readonly prs: number;
  readonly streakDays: number;
  readonly badges: readonly BadgeProgressRow[];
}
