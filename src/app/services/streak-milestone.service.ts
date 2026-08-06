import { Injectable } from '@angular/core';

/** Days at which the celebration fires. Ascending. */
const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365] as const;

const STORAGE_KEY = 'voxfit.streak.celebrated';

/**
 * Decides whether a streak milestone is worth celebrating, and remembers
 * which ones already were.
 *
 * State lives in localStorage rather than the database: a celebration that
 * re-fires is a mild annoyance, not data loss, and this avoids a table for
 * something purely presentational. The trade-off is that the moment can
 * repeat once on a new device — acceptable for what it is.
 */
@Injectable({ providedIn: 'root' })
export class StreakMilestoneService {
  /**
   * The milestone to celebrate for the given streak, or null.
   *
   * Returns the highest milestone at or below `days` so a user who logs after
   * a gap in app usage sees their current achievement rather than a backlog
   * of every milestone they passed.
   */
  pendingMilestone(days: number): number | null {
    const reached = MILESTONES.filter((m) => days >= m);
    const highest = reached[reached.length - 1];
    if (highest === undefined) return null;
    return this.celebrated().includes(highest) ? null : highest;
  }

  markCelebrated(milestone: number): void {
    const next = [...new Set([...this.celebrated(), milestone])];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* Private mode / quota — the celebration simply repeats next time. */
    }
  }

  private celebrated(): number[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
    } catch {
      return [];
    }
  }
}
