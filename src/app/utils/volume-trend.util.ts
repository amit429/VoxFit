import type { VolumeTrend, WeeklyVolumePoint } from '@/app/models';
import { getWeekBoundsForDate, parseLocalDateKey } from '@/app/utils/workout-display.util';

/**
 * Four weeks is the comparison window: long enough that a single missed session
 * doesn't swing it, short enough that "trending up" still describes now.
 */
export const VOLUME_TREND_WINDOW_WEEKS = 4;

/**
 * Below this the nudge stays silent. A 1–2% move between two four-week blocks
 * is noise — one extra set of squats — and a banner that fires on noise stops
 * being read.
 */
export const VOLUME_TREND_MIN_DELTA_PCT = 5;

/**
 * Rolling volume comparison: the last N weeks against the N before, and
 * against every N-week stretch on record.
 *
 * `series` only contains weeks that had volume, so it is densified first —
 * a fortnight off must count as two zero weeks in the rolling sum, not be
 * skipped over as though it never happened. That is the whole difference
 * between an honest trend and one that only ever goes up.
 *
 * `todayKey` is passed in rather than read from the clock so the window's
 * right-hand edge is testable and matches the caller's idea of "now".
 */
export function computeVolumeTrend(
  series: readonly WeeklyVolumePoint[],
  todayKey: string = parseLocalDateKey(new Date()),
  window: number = VOLUME_TREND_WINDOW_WEEKS,
): VolumeTrend {
  const dense = densifyWeeks(series, todayKey);
  const weeksCovered = dense.length;

  const currentKg = sumTail(dense, window);
  const previousKg = weeksCovered >= window * 2 ? sumSlice(dense, weeksCovered - window * 2, window) : 0;

  /*
   * A percentage needs a non-zero baseline. Coming back from a completely
   * blank block is real progress, but "+∞%" is not a claim worth making — the
   * nudge simply stays quiet until there is something to divide by.
   */
  const hasComparison = weeksCovered >= window * 2 && previousKg > 0;
  const deltaPct = hasComparison ? Math.round(((currentKg - previousKg) / previousKg) * 100) : 0;

  return {
    windowWeeks: window,
    currentKg,
    previousKg,
    deltaPct,
    hasComparison,
    /* Only claimable once there is a stretch to have beaten. */
    isBestStretch: weeksCovered > window && currentKg > 0 && currentKg >= bestWindowSum(dense, window),
    weeksCovered,
  };
}

/** True when the trend is worth interrupting the user for. */
export function isTrendingUp(trend: VolumeTrend): boolean {
  return trend.hasComparison && trend.deltaPct >= VOLUME_TREND_MIN_DELTA_PCT;
}

/**
 * Weeks with no volume filled in as zero, from the first logged week through
 * the week containing `todayKey`. Anything after that week is ignored, so a
 * stray future-dated row can't stretch the series.
 */
function densifyWeeks(series: readonly WeeklyVolumePoint[], todayKey: string): number[] {
  if (series.length === 0) return [];

  const byWeek = new Map<string, number>();
  for (const p of series) byWeek.set(p.weekStart, p.volumeKg);

  const sorted = [...byWeek.keys()].sort();
  const firstWeek = sorted[0];
  if (!firstWeek) return [];

  const currentWeek = getWeekBoundsForDate(todayKey).monday;
  if (currentWeek < firstWeek) return [byWeek.get(firstWeek) ?? 0];

  const out: number[] = [];
  const cursor = new Date(`${firstWeek}T00:00:00`);
  /* Guard against a malformed date key spinning this forever. */
  for (let i = 0; i < 1200; i++) {
    const key = parseLocalDateKey(cursor);
    if (key > currentWeek) break;
    out.push(byWeek.get(key) ?? 0);
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

function sumSlice(values: readonly number[], from: number, count: number): number {
  let total = 0;
  for (let i = from; i < from + count; i++) total += values[i] ?? 0;
  return Math.round(total);
}

function sumTail(values: readonly number[], count: number): number {
  return sumSlice(values, Math.max(0, values.length - count), Math.min(count, values.length));
}

/**
 * The largest sum of any `window` consecutive weeks. Windows that would hang
 * off the start of the series are excluded — a three-week-old account has not
 * had a four-week stretch to beat.
 */
function bestWindowSum(values: readonly number[], window: number): number {
  if (values.length < window) return 0;
  let best = 0;
  for (let start = 0; start + window <= values.length; start++) {
    best = Math.max(best, sumSlice(values, start, window));
  }
  return best;
}
