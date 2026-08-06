import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { VoxVolumeBar } from '@/app/models';

/**
 * Weekly volume bars with a delta chip.
 *
 * Two bars are singled out and no others: today in brand periwinkle (where
 * you are) and the week's best in jade (an affirmative reading). Everything
 * else is a neutral white wash — colouring every bar would destroy the
 * comparison the chart exists to make. Bars carry no drop-shadow.
 */
@Component({
  selector: 'vox-volume-chart',
  standalone: true,
  templateUrl: './vox-volume-chart.component.html',
  styleUrl: './vox-volume-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxVolumeChartComponent {
  readonly bars = input.required<readonly VoxVolumeBar[]>();
  readonly total = input<string>('');
  readonly unit = input('kg');
  readonly eyebrow = input('Weekly volume');
  /** Percentage change vs the previous period; null hides the chip. */
  readonly deltaPct = input<number | null>(null);
  /** Index of the bar the user has tapped, or null. */
  readonly selectedIndex = input<number | null>(null);

  readonly barClick = output<number>();

  private readonly maxValue = computed(() => Math.max(...this.bars().map((b) => b.value), 0));

  /** Index of the highest bar; -1 when every value is zero, so nothing is falsely crowned. */
  private readonly bestIndex = computed(() => {
    const max = this.maxValue();
    if (max <= 0) return -1;
    return this.bars().findIndex((b) => b.value === max);
  });

  protected readonly rows = computed(() => {
    const max = this.maxValue();
    const best = this.bestIndex();
    return this.bars().map((bar, i) => ({
      ...bar,
      /* Floor at 4% so an empty day is still a visible baseline tick rather
         than nothing at all. */
      heightPct: max > 0 ? Math.max(4, Math.round((bar.value / max) * 100)) : 4,
      tone: i === best ? 'best' : bar.isToday ? 'today' : bar.value > 0 ? 'plain' : 'empty',
    }));
  });

  protected readonly hasData = computed(() => this.maxValue() > 0);

  protected readonly deltaLabel = computed(() => {
    const d = this.deltaPct();
    if (d === null) return null;
    return `${d >= 0 ? '↑' : '↓'} ${Math.abs(d)}%`;
  });

  protected onBarClick(i: number): void {
    this.barClick.emit(i);
  }
}
