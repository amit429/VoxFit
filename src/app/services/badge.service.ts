import { Injectable } from '@angular/core';
import type { BadgeProgressRow, VoxEarnedBadge, VoxBadgeShelfTone } from '@/app/models';

interface BadgePresentation {
  readonly emoji: string;
  readonly label: string;
  readonly tone: VoxBadgeShelfTone;
}

/**
 * Presentation only, keyed by `badge_key`.
 *
 * Thresholds and awarding live in the database (`badge_definitions`, seeded by
 * migration `0006`) — that is what makes a badge un-fakeable from the client
 * and what stops one un-earning itself when a streak lapses. Nothing here
 * decides whether a badge is held; this table only says how it looks.
 *
 * A key present in the DB but missing here renders with a neutral fallback
 * rather than disappearing, so adding a badge server-side degrades gracefully.
 *
 * Tone follows what the badge measures: apricot for streaks, jade for PRs,
 * brand for logging volume. That keeps the shelf readable by colour.
 */
const PRESENTATION: Record<string, BadgePresentation> = {
  streak_3: { emoji: '🌱', label: '3 DAYS', tone: 'apricot' },
  streak_7: { emoji: '🔥', label: '7 DAYS', tone: 'apricot' },
  streak_14: { emoji: '🔥', label: '14 DAYS', tone: 'apricot' },
  streak_30: { emoji: '⚡', label: '30 DAYS', tone: 'apricot' },
  streak_100: { emoji: '👑', label: '100 DAYS', tone: 'apricot' },

  logs_10: { emoji: '🎙️', label: '10 LOGS', tone: 'brand' },
  logs_50: { emoji: '🎙️', label: '50 LOGS', tone: 'brand' },
  logs_100: { emoji: '🏛️', label: '100 LOGS', tone: 'brand' },
  logs_250: { emoji: '🚀', label: '250 LOGS', tone: 'brand' },

  pr_1: { emoji: '⭐', label: 'FIRST PR', tone: 'jade' },
  pr_10: { emoji: '💪', label: '10 PRs', tone: 'jade' },
  pr_25: { emoji: '🏆', label: '25 PRs', tone: 'jade' },
  pr_50: { emoji: '🥇', label: '50 PRs', tone: 'jade' },
};

const FALLBACK: BadgePresentation = { emoji: '🎖️', label: 'BADGE', tone: 'slate' };

/** Maps the server's badge rows onto shelf tiles. */
@Injectable({ providedIn: 'root' })
export class BadgeService {
  toShelf(rows: readonly BadgeProgressRow[]): VoxEarnedBadge[] {
    return rows.map((row) => {
      const look = PRESENTATION[row.badge_key] ?? FALLBACK;
      return {
        key: row.badge_key,
        emoji: look.emoji,
        label: look.label,
        tone: look.tone,
        earned: row.earned_at !== null,
      };
    });
  }
}
