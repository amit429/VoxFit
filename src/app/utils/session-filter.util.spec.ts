import { countMatchingSessions, sessionMatchesFilters } from '@/app/utils/session-filter.util';
import { EMPTY_SESSION_FILTERS } from '@/app/components/vox-filter-sheet/vox-filter-sheet.component';
import type { MoodDb, WorkoutSessionListMock } from '@/app/models';

function session(overrides: Partial<WorkoutSessionListMock> = {}): WorkoutSessionListMock {
  return {
    id: 'a',
    label: 'Session',
    dateLabel: 'Mon 1 Jan',
    dateKey: '2026-01-01',
    exercises: 3,
    mood: null,
    moodEmoji: '😐',
    energyLabel: 'Med',
    hasFlag: false,
    hasPr: false,
    ...overrides,
  };
}

describe('sessionMatchesFilters', () => {
  it('matches everything when no filters are set', () => {
    expect(sessionMatchesFilters(session(), EMPTY_SESSION_FILTERS)).toBe(true);
  });

  it('filters on PRs', () => {
    const filters = { ...EMPTY_SESSION_FILTERS, prsOnly: true };

    expect(sessionMatchesFilters(session({ hasPr: true }), filters)).toBe(true);
    expect(sessionMatchesFilters(session({ hasPr: false }), filters)).toBe(false);
  });

  it('filters on notes', () => {
    const filters = { ...EMPTY_SESSION_FILTERS, notesOnly: true };

    expect(sessionMatchesFilters(session({ hasFlag: true }), filters)).toBe(true);
    expect(sessionMatchesFilters(session({ hasFlag: false }), filters)).toBe(false);
  });

  it('combines filters as AND, not OR', () => {
    const filters = { ...EMPTY_SESSION_FILTERS, prsOnly: true, notesOnly: true };

    expect(sessionMatchesFilters(session({ hasPr: true, hasFlag: false }), filters)).toBe(false);
    expect(sessionMatchesFilters(session({ hasPr: true, hasFlag: true }), filters)).toBe(true);
  });

  it('matches any of the selected moods', () => {
    const filters = { ...EMPTY_SESSION_FILTERS, moods: ['positive', 'negative'] as MoodDb[] };

    expect(sessionMatchesFilters(session({ mood: 'positive' }), filters)).toBe(true);
    expect(sessionMatchesFilters(session({ mood: 'negative' }), filters)).toBe(true);
    expect(sessionMatchesFilters(session({ mood: 'neutral' }), filters)).toBe(false);
  });

  /*
   * Regression: mood used to be compared via its emoji, and moodEmoji(null)
   * renders the same 😐 as 'neutral' — so filtering by Neutral swept in every
   * session that had no mood recorded at all.
   */
  it('does not match a null mood against the neutral filter', () => {
    const filters = { ...EMPTY_SESSION_FILTERS, moods: ['neutral'] as MoodDb[] };

    expect(sessionMatchesFilters(session({ mood: null, moodEmoji: '😐' }), filters)).toBe(false);
  });
});

describe('countMatchingSessions', () => {
  it('counts only matching sessions', () => {
    const sessions = [
      session({ id: '1', hasPr: true }),
      session({ id: '2', hasPr: false }),
      session({ id: '3', hasPr: true }),
    ];

    expect(countMatchingSessions(sessions, { ...EMPTY_SESSION_FILTERS, prsOnly: true })).toBe(2);
  });

  it('counts everything when unfiltered', () => {
    expect(countMatchingSessions([session(), session()], EMPTY_SESSION_FILTERS)).toBe(2);
  });
});
