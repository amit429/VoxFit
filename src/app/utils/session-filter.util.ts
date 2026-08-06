import type { VoxSessionFilters, WorkoutSessionListMock } from '@/app/models';

/**
 * The one place a session is tested against the filter set.
 *
 * Shared so the filter sheet's "Show N sessions" preview and the list itself
 * can never disagree — they were two separate predicates before, and the
 * preview silently reported the pre-filter count.
 */
export function sessionMatchesFilters(
  session: WorkoutSessionListMock,
  filters: VoxSessionFilters,
): boolean {
  if (filters.prsOnly && !session.hasPr) return false;
  if (filters.notesOnly && !session.hasFlag) return false;
  /*
   * A session with no recorded mood matches no mood filter. Testing the
   * stored value rather than the emoji matters: moodEmoji(null) and
   * moodEmoji('neutral') are the same glyph.
   */
  if (filters.moods.length > 0 && (session.mood === null || !filters.moods.includes(session.mood))) {
    return false;
  }
  return true;
}

export function countMatchingSessions(
  sessions: readonly WorkoutSessionListMock[],
  filters: VoxSessionFilters,
): number {
  return sessions.reduce((n, s) => (sessionMatchesFilters(s, filters) ? n + 1 : n), 0);
}
