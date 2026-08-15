import type { VoxTrendPoint } from '@/app/models';
import { parseLocalDateKey } from '@/app/utils/workout-display.util';

/**
 * Geometry for the strength-trend chart, as pure functions.
 *
 * Split out of the component because this is where the chart's correctness
 * actually lives — time-proportional spacing and label thinning are easy to get
 * subtly wrong and impossible to check by looking at a screenshot.
 *
 * Everything here works in **fractions** (0–1) of the plot box rather than
 * pixels or viewBox units. The SVG is stretched to its container, so the only
 * stable coordinate space is a relative one; the component turns these into
 * percentages.
 */

/** One plotted session, positioned. */
export interface TrendCoord {
  readonly dateKey: string;
  readonly value: number;
  readonly isPr: boolean;
  /** 0 = oldest session, 1 = newest. Proportional to elapsed time. */
  readonly xFraction: number;
  /** 0 = top of the plot (highest weight), 1 = bottom (lowest). */
  readonly yFraction: number;
  readonly isBest: boolean;
}

/** A date label that survived thinning, with the position it belongs under. */
export interface TrendAxisLabel {
  readonly text: string;
  readonly xFraction: number;
}

/**
 * Minimum spacing between two x-axis labels, as a fraction of chart width.
 *
 * 0.19 fits at most 5 labels on a 320px-wide plot at the axis font size without
 * them touching. This is the whole anti-clutter mechanism: labels are dropped,
 * never shrunk or rotated, because rotated dates on a phone are unreadable and
 * shrinking them fails accessibility sizing.
 */
const MIN_LABEL_GAP_FRACTION = 0.19;

const MS_PER_DAY = 86_400_000;

function dayNumber(dateKey: string): number {
  const d = new Date(`${dateKey}T00:00:00`);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : Math.round(t / MS_PER_DAY);
}

/**
 * Places each point in the unit box.
 *
 * X is proportional to elapsed *time*, not index — a month-long plateau must
 * look like a month, not like one step. When every session shares a date (or
 * there is only one) the span collapses, and points are spread evenly instead
 * so they don't stack into a single column.
 */
export function buildTrendCoords(points: readonly VoxTrendPoint[]): TrendCoord[] {
  if (points.length === 0) return [];

  const values = points.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  /* A flat series would divide by zero; draw it as a mid-height line. */
  const valueSpan = maxValue - minValue || 1;
  const flat = maxValue === minValue;

  const days = points.map((p) => dayNumber(p.dateKey));
  const firstDay = days[0] ?? 0;
  const daySpan = (days[days.length - 1] ?? 0) - firstDay;

  /* Most recent occurrence of the max, so a tie credits the latest session. */
  const bestIdx = values.lastIndexOf(maxValue);

  return points.map((p, i) => ({
    dateKey: p.dateKey,
    value: p.value,
    isPr: !!p.isPr,
    xFraction:
      daySpan > 0 ? ((days[i] ?? 0) - firstDay) / daySpan
      : points.length > 1 ? i / (points.length - 1)
      : 0.5,
    yFraction: flat ? 0.5 : 1 - (p.value - minValue) / valueSpan,
    isBest: i === bestIdx,
  }));
}

/**
 * The three y-axis gridline values: max, midpoint, min.
 *
 * Returns an empty list for a flat series — three identical numbers stacked up
 * the side is noise, and the headline already states the value.
 */
export function trendAxisValues(points: readonly VoxTrendPoint[]): number[] {
  if (points.length === 0) return [];
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return [];
  return [max, (max + min) / 2, min];
}

/** Trims trailing zeros so 47.5 stays 47.5 while 30.0 renders as 30. */
export function formatTrendWeight(kg: number): string {
  return `${Math.round(kg * 10) / 10}`;
}

/**
 * Compact date for the x-axis: `16 Aug`, or `16 Aug 25` when the series crosses
 * into another calendar year and the bare day/month would be ambiguous.
 */
export function formatTrendAxisDate(dateKey: string, includeYear: boolean): string {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: 'short' });
  if (!includeYear) return `${day} ${month}`;
  return `${day} ${month} ${String(d.getFullYear()).slice(2)}`;
}

/** Longer form for the tap readout, where there is room for the weekday. */
export function formatTrendReadoutDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  if (parseLocalDateKey(new Date()) === dateKey) return 'Today';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Picks which dates to label, keeping the first and last and filling inward
 * only where there is room.
 *
 * Anchoring on both ends matters more than even distribution: those two dates
 * are what tell the user the window the chart covers. Interior labels are a
 * bonus, so they are added left-to-right and skipped whenever the previous kept
 * label is closer than `MIN_LABEL_GAP_FRACTION` — which is why clustered
 * sessions thin out instead of overlapping.
 */
export function buildTrendAxisLabels(coords: readonly TrendCoord[]): TrendAxisLabel[] {
  if (coords.length === 0) return [];

  const first = coords[0];
  const last = coords[coords.length - 1];
  if (!first || !last) return [];

  const years = new Set(coords.map((c) => c.dateKey.slice(0, 4)));
  const includeYear = years.size > 1;
  const label = (c: TrendCoord): TrendAxisLabel => ({
    text: formatTrendAxisDate(c.dateKey, includeYear),
    xFraction: c.xFraction,
  });

  if (coords.length === 1) return [label(first)];

  const kept: TrendAxisLabel[] = [label(first)];
  for (let i = 1; i < coords.length - 1; i++) {
    const c = coords[i];
    const prev = kept[kept.length - 1];
    if (!c || !prev) continue;
    /* Must clear the previous label AND leave room before the final one. */
    if (c.xFraction - prev.xFraction < MIN_LABEL_GAP_FRACTION) continue;
    if (last.xFraction - c.xFraction < MIN_LABEL_GAP_FRACTION) continue;
    kept.push(label(c));
  }
  kept.push(label(last));
  return kept;
}
