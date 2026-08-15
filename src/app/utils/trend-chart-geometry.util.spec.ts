import {
  buildTrendAxisLabels,
  buildTrendCoords,
  formatTrendWeight,
  trendAxisValues,
} from '@/app/utils/trend-chart-geometry.util';
import type { VoxTrendPoint } from '@/app/models';

/** The real series from the user's Incline Bench Press history. */
const REAL: VoxTrendPoint[] = [
  { dateKey: '2026-07-20', value: 17.5, isPr: true },
  { dateKey: '2026-07-22', value: 30, isPr: true },
  { dateKey: '2026-08-16', value: 30, isPr: false },
];

describe('trend chart geometry', () => {
  describe('buildTrendCoords', () => {
    it('spaces points by elapsed time, not by index', () => {
      const [a, b, c] = buildTrendCoords(REAL);

      // 2 days into a 27-day span, not the 0.5 an ordinal axis would give.
      expect(a!.xFraction).toBe(0);
      expect(b!.xFraction).toBeCloseTo(2 / 27, 4);
      expect(c!.xFraction).toBe(1);
    });

    it('puts the lowest weight at the bottom and the highest at the top', () => {
      const [a, b, c] = buildTrendCoords(REAL);

      expect(a!.yFraction).toBe(1);
      expect(b!.yFraction).toBe(0);
      expect(c!.yFraction).toBe(0);
    });

    it('credits the most recent session when the best weight is tied', () => {
      const coords = buildTrendCoords(REAL);

      expect(coords.map((p) => p.isBest)).toEqual([false, false, true]);
    });

    it('draws a flat series down the middle rather than dividing by zero', () => {
      const coords = buildTrendCoords([
        { dateKey: '2026-01-01', value: 40 },
        { dateKey: '2026-01-08', value: 40 },
      ]);

      expect(coords.map((c) => c.yFraction)).toEqual([0.5, 0.5]);
    });

    it('spreads points evenly when every session shares one date', () => {
      // Same-day sessions have no elapsed time to scale by; stacking them in one
      // column would hide points behind each other.
      const coords = buildTrendCoords([
        { dateKey: '2026-03-02', value: 20 },
        { dateKey: '2026-03-02', value: 25 },
        { dateKey: '2026-03-02', value: 30 },
      ]);

      expect(coords.map((c) => c.xFraction)).toEqual([0, 0.5, 1]);
    });

    it('centres a lone point', () => {
      expect(buildTrendCoords([{ dateKey: '2026-03-02', value: 20 }])[0]!.xFraction).toBe(0.5);
    });
  });

  describe('trendAxisValues', () => {
    it('labels max, midpoint and min', () => {
      expect(trendAxisValues(REAL)).toEqual([30, 23.75, 17.5]);
    });

    it('omits the scale for a flat series, where three identical numbers say nothing', () => {
      expect(
        trendAxisValues([
          { dateKey: '2026-01-01', value: 40 },
          { dateKey: '2026-01-08', value: 40 },
        ]),
      ).toEqual([]);
    });
  });

  describe('buildTrendAxisLabels', () => {
    it('always keeps the first and last date, so the window is readable', () => {
      const labels = buildTrendAxisLabels(buildTrendCoords(REAL));

      expect(labels[0]!.xFraction).toBe(0);
      expect(labels[labels.length - 1]!.xFraction).toBe(1);
    });

    it('drops an interior date that would collide with its neighbour', () => {
      // 20 and 22 July sit 2/27 apart — far closer than the minimum gap.
      const labels = buildTrendAxisLabels(buildTrendCoords(REAL));

      expect(labels.length).toBe(2);
      expect(labels.map((l) => l.text)).toEqual(['20 Jul', '16 Aug']);
    });

    it('keeps interior dates that are spaced out enough', () => {
      const labels = buildTrendAxisLabels(
        buildTrendCoords([
          { dateKey: '2026-01-01', value: 10 },
          { dateKey: '2026-02-01', value: 20 },
          { dateKey: '2026-03-01', value: 30 },
        ]),
      );

      expect(labels.length).toBe(3);
    });

    it('adds a year only once the series crosses one', () => {
      const sameYear = buildTrendAxisLabels(buildTrendCoords(REAL));
      expect(sameYear[0]!.text).toBe('20 Jul');

      const crossing = buildTrendAxisLabels(
        buildTrendCoords([
          { dateKey: '2025-11-02', value: 10 },
          { dateKey: '2026-03-02', value: 20 },
        ]),
      );
      expect(crossing[0]!.text).toBe('2 Nov 25');
    });

    it('never emits labels for an empty series', () => {
      expect(buildTrendAxisLabels([])).toEqual([]);
    });
  });

  describe('formatTrendWeight', () => {
    it('keeps a half-kilo but drops a trailing zero', () => {
      expect(formatTrendWeight(17.5)).toBe('17.5');
      expect(formatTrendWeight(30)).toBe('30');
      expect(formatTrendWeight(22.25)).toBe('22.3');
    });
  });
});
