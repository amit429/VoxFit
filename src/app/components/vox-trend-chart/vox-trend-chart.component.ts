import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import type { VoxTrendPoint } from '@/app/models';
import {
  buildTrendAxisLabels,
  buildTrendCoords,
  formatTrendReadoutDate,
  formatTrendWeight,
  trendAxisValues,
  type TrendCoord,
} from '@/app/utils/trend-chart-geometry.util';

/* viewBox geometry. Fixed so the path maths stays readable; the SVG scales. */
const VB_W = 310;
const VB_H = 104;

/**
 * Strength trend — top set per session over a bounded window.
 *
 * Jade area-filled line for the series, apricot dots on PR sessions, and a
 * larger jade dot on the current best. No glow filters: the fill gradient
 * does the depth work.
 *
 * Only the line, fill and gridlines live in the SVG. Dots, axis labels and the
 * tap readout are HTML positioned in percentages over it, for two reasons: the
 * SVG is stretched with `preserveAspectRatio="none"`, which turns SVG circles
 * into ellipses and would distort any text inside it; and HTML dots can carry
 * a tap target far larger than the 5px they draw, which is what makes reading a
 * value on a phone possible at all.
 */
@Component({
  selector: 'vox-trend-chart',
  standalone: true,
  imports: [VoxSkeletonComponent],
  templateUrl: './vox-trend-chart.component.html',
  styleUrl: './vox-trend-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxTrendChartComponent {
  readonly points = input.required<readonly VoxTrendPoint[]>();
  readonly title = input('');
  readonly subtitle = input('');
  readonly headline = input('');
  /** Shown next to each y-axis value, e.g. `kg`. */
  readonly unit = input('kg');
  /**
   * Swaps the plot for a skeleton while a new series is being fetched. The
   * header stays rendered throughout: the chart's subject is chosen from within
   * its own header, so collapsing the card would move the control the user just
   * used out from under their thumb.
   */
  readonly loading = input(false);
  /** Unique per instance — SVG gradient ids are document-global. */
  readonly gradientId = input('vox-trend-fill');

  protected readonly vbWidth = VB_W;
  protected readonly vbHeight = VB_H;

  /** Index of the point the user tapped, or null when nothing is selected. */
  private readonly selectedIndex = signal<number | null>(null);

  protected readonly hasData = computed(() => this.points().length >= 2);

  protected readonly coords = computed(() => buildTrendCoords(this.points()));

  /** Gridline values, top to bottom — also the y-axis labels. */
  protected readonly axisValues = computed(() => trendAxisValues(this.points()));

  protected readonly axisLabels = computed(() => buildTrendAxisLabels(this.coords()));

  protected readonly linePath = computed(() =>
    this.coords()
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${this.vx(c).toFixed(1)} ${this.vy(c).toFixed(1)}`)
      .join(' '),
  );

  /** Line path closed down to the baseline, for the area fill. */
  protected readonly areaPath = computed(() => {
    const cs = this.coords();
    const first = cs[0];
    const last = cs[cs.length - 1];
    if (!first || !last) return '';
    return `${this.linePath()} L ${this.vx(last).toFixed(1)} ${VB_H} L ${this.vx(first).toFixed(1)} ${VB_H} Z`;
  });

  /**
   * The tapped point's readout, or the most recent session's when nothing has
   * been tapped — so the card always states a concrete value instead of
   * requiring interaction to say anything at all.
   */
  protected readonly readout = computed(() => {
    const cs = this.coords();
    if (cs.length === 0) return null;
    const idx = this.selectedIndex() ?? cs.length - 1;
    const c = cs[idx];
    if (!c) return null;
    return {
      weight: `${formatTrendWeight(c.value)} ${this.unit()}`,
      date: formatTrendReadoutDate(c.dateKey),
      isPr: c.isPr,
      isSelected: this.selectedIndex() !== null,
    };
  });

  protected isSelected(i: number): boolean {
    return this.selectedIndex() === i;
  }

  /** Tapping the active point clears it, so the readout can return to latest. */
  protected select(i: number): void {
    this.selectedIndex.update((cur) => (cur === i ? null : i));
  }

  protected pointLabel(c: TrendCoord): string {
    return `${formatTrendReadoutDate(c.dateKey)}: ${formatTrendWeight(c.value)} ${this.unit()}${c.isPr ? ', personal record' : ''}`;
  }

  protected percent(fraction: number): string {
    return `${(fraction * 100).toFixed(2)}%`;
  }

  protected formatWeight(kg: number): string {
    return formatTrendWeight(kg);
  }

  /** Unit-box fraction → viewBox units, for the SVG path only. */
  private vx(c: TrendCoord): number {
    return c.xFraction * VB_W;
  }

  private vy(c: TrendCoord): number {
    return c.yFraction * VB_H;
  }
}
