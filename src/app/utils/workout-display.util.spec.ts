import {
  computeLongestStreakDays,
  computeWorkoutStreakDays,
  flagsSummary,
  parseLocalDateKey,
} from '@/app/utils/workout-display.util';

/** `YYYY-MM-DD` for `n` days before today, local. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return parseLocalDateKey(d);
}

describe('computeWorkoutStreakDays', () => {
  it('is zero with no sessions', () => {
    expect(computeWorkoutStreakDays(new Set())).toBe(0);
  });

  it('counts a run ending today', () => {
    expect(computeWorkoutStreakDays(new Set([daysAgo(0), daysAgo(1), daysAgo(2)]))).toBe(3);
  });

  /* The day is not over — a streak must not collapse at midnight. */
  it('allows today to be empty if yesterday is logged', () => {
    expect(computeWorkoutStreakDays(new Set([daysAgo(1), daysAgo(2)]))).toBe(2);
  });

  /*
   * Regression: the old implementation walked back past any number of empty
   * days to find the most recent session, so one workout weeks ago still
   * reported a live 1-day streak.
   */
  it('is zero when neither today nor yesterday is logged', () => {
    expect(computeWorkoutStreakDays(new Set([daysAgo(16), daysAgo(17)]))).toBe(0);
  });

  it('stops at the first gap rather than counting later runs', () => {
    expect(computeWorkoutStreakDays(new Set([daysAgo(0), daysAgo(1), daysAgo(5), daysAgo(6)]))).toBe(2);
  });
});

describe('computeLongestStreakDays', () => {
  it('is zero with no sessions', () => {
    expect(computeLongestStreakDays(new Set())).toBe(0);
  });

  it('is one for a single logged day', () => {
    expect(computeLongestStreakDays(new Set(['2026-03-04']))).toBe(1);
  });

  it('finds the longest run, not the most recent', () => {
    const dates = new Set([
      '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04',
      '2026-02-10', '2026-02-11',
    ]);

    expect(computeLongestStreakDays(dates)).toBe(4);
  });

  it('handles a run spanning a month boundary', () => {
    expect(computeLongestStreakDays(new Set(['2026-01-30', '2026-01-31', '2026-02-01']))).toBe(3);
  });
});

describe('flagsSummary', () => {
  it('reports no flags for null, empty, and whitespace-only input', () => {
    for (const input of [null, undefined, [], ['', '   ']]) {
      expect(flagsSummary(input).hasFlags).toBe(false);
    }
  });

  it('reports flags when at least one is non-empty', () => {
    expect(flagsSummary(['', 'left knee tight']).hasFlags).toBe(true);
  });

  it('joins multiple notes', () => {
    expect(flagsSummary(['knee', 'shoulder']).body).toBe('knee · shoulder');
  });

  /*
   * Framing guard, not a formatting preference. The AI Coach PRD requires
   * observational wording — the underlying data is free text captured mid-set
   * by unreliable speech recognition, so clinical register implies an
   * assessment the data cannot support.
   */
  it('uses observational wording, never clinical register', () => {
    const withFlags = flagsSummary(['knee']);
    const without = flagsSummary([]);

    for (const result of [withFlags, without]) {
      const text = `${result.title} ${result.body}`.toLowerCase();
      for (const banned of ['flag', 'diagnos', 'healthcare', 'health', 'injur', 'symptom', 'issue']) {
        expect(text).not.toContain(banned);
      }
    }
  });
});
