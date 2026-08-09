import type { WeeklyVolumePoint } from '@/app/models';
import { computeVolumeTrend, isTrendingUp } from '@/app/utils/volume-trend.util';

/** Mondays, so the keys line up with what `get_weekly_volume_series` returns. */
function weeksEndingAt(lastMonday: string, volumes: readonly number[]): WeeklyVolumePoint[] {
  const out: WeeklyVolumePoint[] = [];
  const cursor = new Date(`${lastMonday}T00:00:00`);
  cursor.setDate(cursor.getDate() - (volumes.length - 1) * 7);
  for (const volumeKg of volumes) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    out.push({ weekStart: `${y}-${m}-${d}`, volumeKg });
    cursor.setDate(cursor.getDate() + 7);
  }
  /* Weeks with no volume are absent from the RPC payload, as in production. */
  return out.filter((p) => p.volumeKg > 0);
}

/* 2026-08-03 is a Monday; 2026-08-09 falls inside that week. */
const TODAY = '2026-08-09';
const THIS_WEEK = '2026-08-03';

describe('computeVolumeTrend', () => {
  it('compares the last four weeks against the four before', () => {
    const series = weeksEndingAt(THIS_WEEK, [100, 100, 100, 100, 120, 120, 120, 120]);
    const trend = computeVolumeTrend(series, TODAY);

    expect(trend.previousKg).toBe(400);
    expect(trend.currentKg).toBe(480);
    expect(trend.deltaPct).toBe(20);
    expect(trend.hasComparison).toBeTrue();
    expect(isTrendingUp(trend)).toBeTrue();
  });

  it('reports a decline rather than suppressing it', () => {
    const series = weeksEndingAt(THIS_WEEK, [200, 200, 200, 200, 150, 150, 150, 150]);
    const trend = computeVolumeTrend(series, TODAY);

    expect(trend.deltaPct).toBe(-25);
    /* The nudge only has an "up" state, so a decline must not fire it. */
    expect(isTrendingUp(trend)).toBeFalse();
  });

  it('stays silent on a move small enough to be one extra set', () => {
    const series = weeksEndingAt(THIS_WEEK, [100, 100, 100, 100, 101, 100, 100, 100]);
    const trend = computeVolumeTrend(series, TODAY);

    expect(trend.deltaPct).toBe(0);
    expect(isTrendingUp(trend)).toBeFalse();
  });

  /**
   * Regression guard for the whole point of densifying: the RPC omits weeks
   * with no volume, so a naive "last four entries" read would compare the last
   * four *logged* weeks and report growth across a two-month layoff.
   */
  it('counts weeks off as zero rather than skipping them', () => {
    const series: WeeklyVolumePoint[] = [
      { weekStart: '2026-05-04', volumeKg: 1000 },
      { weekStart: '2026-05-11', volumeKg: 1000 },
      { weekStart: '2026-05-18', volumeKg: 1000 },
      { weekStart: '2026-05-25', volumeKg: 1000 },
      /* Nine weeks off, then one week back. */
      { weekStart: '2026-08-03', volumeKg: 500 },
    ];
    const trend = computeVolumeTrend(series, TODAY);

    expect(trend.currentKg).toBe(500);
    expect(trend.previousKg).toBe(0);
    expect(trend.hasComparison).toBeFalse();
    expect(isTrendingUp(trend)).toBeFalse();
  });

  it('needs a non-zero baseline before claiming a percentage', () => {
    const series = weeksEndingAt(THIS_WEEK, [0, 0, 0, 0, 100, 100, 100, 100]);
    const trend = computeVolumeTrend(series, TODAY);

    expect(trend.previousKg).toBe(0);
    expect(trend.deltaPct).toBe(0);
    expect(trend.hasComparison).toBeFalse();
  });

  it('needs two full windows of history', () => {
    const series = weeksEndingAt(THIS_WEEK, [100, 100, 100, 120, 130]);
    const trend = computeVolumeTrend(series, TODAY);

    expect(trend.weeksCovered).toBe(5);
    expect(trend.hasComparison).toBeFalse();
  });

  it('claims the best stretch only when no earlier window beat it', () => {
    const rising = computeVolumeTrend(
      weeksEndingAt(THIS_WEEK, [100, 100, 100, 100, 200, 200, 200, 200]),
      TODAY,
    );
    expect(rising.isBestStretch).toBeTrue();

    const pastPeak = computeVolumeTrend(
      weeksEndingAt(THIS_WEEK, [300, 300, 300, 300, 200, 200, 200, 200]),
      TODAY,
    );
    expect(pastPeak.isBestStretch).toBeFalse();
  });

  it('does not call a first partial window a record', () => {
    const trend = computeVolumeTrend(weeksEndingAt(THIS_WEEK, [100, 100]), TODAY);

    expect(trend.weeksCovered).toBe(2);
    expect(trend.isBestStretch).toBeFalse();
  });

  it('treats an empty history as no trend at all', () => {
    const trend = computeVolumeTrend([], TODAY);

    expect(trend.weeksCovered).toBe(0);
    expect(trend.currentKg).toBe(0);
    expect(trend.hasComparison).toBeFalse();
    expect(trend.isBestStretch).toBeFalse();
  });

  /**
   * The current week is the right-hand edge of the window even when nothing
   * has been logged in it yet — otherwise the comparison quietly shifts back a
   * week every Monday and reports last week's numbers as this week's.
   */
  it('anchors the window to the current week, logged or not', () => {
    const series: WeeklyVolumePoint[] = [
      { weekStart: '2026-06-29', volumeKg: 100 },
      { weekStart: '2026-07-06', volumeKg: 100 },
      { weekStart: '2026-07-13', volumeKg: 100 },
      { weekStart: '2026-07-20', volumeKg: 100 },
      { weekStart: '2026-07-27', volumeKg: 100 },
    ];
    const trend = computeVolumeTrend(series, TODAY);

    /* 2026-07-13 … 2026-08-03, with the current week empty. */
    expect(trend.currentKg).toBe(300);
    expect(trend.weeksCovered).toBe(6);
  });
});
