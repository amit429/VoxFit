import { Injectable } from '@angular/core';
import type { VoxEarnedBadge, VoxBadgeShelfTone } from '@/app/models';

interface BadgeDefinition {
  readonly key: string;
  readonly emoji: string;
  readonly label: string;
  readonly tone: VoxBadgeShelfTone;
  readonly threshold: number;
  readonly metric: 'streak' | 'workouts' | 'prs';
}

/**
 * Badge definitions live in code, not the database — only the fact that a
 * badge is earned is derived, and that derivation is cheap from counts the
 * Profile page already loads.
 *
 * Tone follows what the badge measures: apricot for streaks, jade for PRs,
 * brand for logging volume. That keeps the shelf readable by colour.
 */
const DEFINITIONS: readonly BadgeDefinition[] = [
  { key: 'streak_3', emoji: '🌱', label: '3 DAYS', tone: 'apricot', threshold: 3, metric: 'streak' },
  { key: 'streak_7', emoji: '🔥', label: '7 DAYS', tone: 'apricot', threshold: 7, metric: 'streak' },
  { key: 'streak_14', emoji: '🔥', label: '14 DAYS', tone: 'apricot', threshold: 14, metric: 'streak' },
  { key: 'streak_30', emoji: '⚡', label: '30 DAYS', tone: 'apricot', threshold: 30, metric: 'streak' },
  { key: 'streak_100', emoji: '👑', label: '100 DAYS', tone: 'apricot', threshold: 100, metric: 'streak' },

  { key: 'logs_10', emoji: '🎙️', label: '10 LOGS', tone: 'brand', threshold: 10, metric: 'workouts' },
  { key: 'logs_50', emoji: '🎙️', label: '50 LOGS', tone: 'brand', threshold: 50, metric: 'workouts' },
  { key: 'logs_100', emoji: '🏛️', label: '100 LOGS', tone: 'brand', threshold: 100, metric: 'workouts' },
  { key: 'logs_250', emoji: '🚀', label: '250 LOGS', tone: 'brand', threshold: 250, metric: 'workouts' },

  { key: 'pr_1', emoji: '⭐', label: 'FIRST PR', tone: 'jade', threshold: 1, metric: 'prs' },
  { key: 'pr_10', emoji: '💪', label: '10 PRs', tone: 'jade', threshold: 10, metric: 'prs' },
  { key: 'pr_25', emoji: '🏆', label: '25 PRs', tone: 'jade', threshold: 25, metric: 'prs' },
  { key: 'pr_50', emoji: '🥇', label: '50 PRs', tone: 'jade', threshold: 50, metric: 'prs' },
];

export interface BadgeMetrics {
  readonly streakDays: number;
  readonly workouts: number;
  readonly prs: number;
}

/**
 * Evaluates the badge shelf from live counts.
 *
 * There is no `user_badges` table, so a badge has no earned-at date and can
 * un-earn if the underlying metric falls (a lapsed streak). That is a known
 * limitation — see Deferred #3 in REVAMP-PROGRESS.md.
 */
@Injectable({ providedIn: 'root' })
export class BadgeService {
  evaluate(metrics: BadgeMetrics): VoxEarnedBadge[] {
    return DEFINITIONS.map((def) => ({
      key: def.key,
      emoji: def.emoji,
      label: def.label,
      tone: def.tone,
      earned: this.metricValue(def.metric, metrics) >= def.threshold,
    }));
  }

  private metricValue(metric: BadgeDefinition['metric'], metrics: BadgeMetrics): number {
    switch (metric) {
      case 'streak':
        return metrics.streakDays;
      case 'workouts':
        return metrics.workouts;
      case 'prs':
        return metrics.prs;
    }
  }
}
