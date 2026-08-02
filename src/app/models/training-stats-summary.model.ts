import type { GoalType } from '@/app/models/goal-type.model';
import type { SportType } from '@/app/models/sport-type.model';

/** One frequently-logged exercise with its most recent working numbers. */
export interface TopExerciseStat {
  name: string;
  type: 'strength' | 'cardio' | null;
  timesLogged: number;
  lastWeightKg: number | null;
  lastReps: number | null;
}

/**
 * Bounded digest of a user's recent training, built server-side by the agent's
 * tools (or client-side for the local-dev direct path). This is the exact object
 * persisted as `workout_plans.stats_snapshot`.
 */
export interface TrainingStatsSummary {
  goal: GoalType | null;
  sportType: SportType | null;
  targetCalories: number | null;
  targetProteinG: number | null;
  windowWeeks: number;
  sessionsInWindow: number;
  avgSessionsPerWeek: number;
  currentStreakDays: number;
  /** One tonnage figure per week in the window, most-recent-last. */
  weeklyVolumeKg: number[];
  prCount: number;
  topExercises: TopExerciseStat[];
  /** Deduplicated recent physical-flag notes (free text). */
  recentFlags: string[];
}
