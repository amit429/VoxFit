import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { VoxTrendPoint } from '@/app/models';

/* viewBox geometry. Fixed so the path maths stays readable; the SVG scales. */
const VB_W = 310;
const VB_H = 104;
const PAD_X = 6;
const PAD_TOP = 12;
const PAD_BOTTOM = 20;

/**
 * Strength trend — top set per session over a bounded window.
 *
 * Jade area-filled line for the series, apricot dots on PR sessions, and a
 * larger jade dot on the current best. No glow filters: the fill gradient
 * does the depth work.
 */
@Component({
  selector: 'vox-trend-chart',
  standalone: true,
  templateUrl: './vox-trend-chart.component.html',
  styleUrl: './vox-trend-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxTrendChartComponent {
  readonly points = input.required<readonly VoxTrendPoint[]>();
  readonly title = input('');
  readonly subtitle = input('');
  readonly headline = input('');
  /** Unique per instance — SVG gradient ids are document-global. */
  readonly gradientId = input('vox-trend-fill');

  protected readonly vbWidth = VB_W;
  protected readonly vbHeight = VB_H;

  protected readonly hasData = computed(() => this.points().length >= 2);

  /** Screen-space coordinates, plus the flags each dot needs. */
  private readonly coords = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return [];

    const values = pts.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    /* A flat series would divide by zero; render it as a mid-height line. */
    const span = max - min || 1;
    const usableH = VB_H - PAD_TOP - PAD_BOTTOM;
    const stepX = pts.length > 1 ? (VB_W - PAD_X * 2) / (pts.length - 1) : 0;
    const bestIdx = values.lastIndexOf(max);

    return pts.map((p, i) => ({
      x: PAD_X + stepX * i,
      y: PAD_TOP + usableH * (1 - (p.value - min) / span),
      isPr: !!p.isPr,
      isBest: i === bestIdx,
      label: p.label,
      value: p.value,
    }));
  });

  protected readonly linePath = computed(() =>
    this.coords()
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' '),
  );

  /** Line path closed down to the baseline, for the area fill. */
  protected readonly areaPath = computed(() => {
    const cs = this.coords();
    if (cs.length === 0) return '';
    const first = cs[0];
    const last = cs[cs.length - 1];
    if (!first || !last) return '';
    return `${this.linePath()} L ${last.x.toFixed(1)} ${VB_H} L ${first.x.toFixed(1)} ${VB_H} Z`;
  });

  /** PR markers, excluding the current best (which gets its own larger dot). */
  protected readonly prDots = computed(() => this.coords().filter((c) => c.isPr && !c.isBest));

  protected readonly bestDot = computed(() => this.coords().find((c) => c.isBest) ?? null);

  protected readonly gridLines = [20, 52, 84];

  /** Up to five evenly-sampled labels so the axis never crowds on a phone. */
  protected readonly axisLabels = computed(() => {
    const cs = this.coords();
    if (cs.length === 0) return [];
    if (cs.length <= 5) return cs.map((c) => c.label);
    const step = (cs.length - 1) / 4;
    return [0, 1, 2, 3, 4].map((i) => cs[Math.round(step * i)]?.label ?? '');
  });
}
