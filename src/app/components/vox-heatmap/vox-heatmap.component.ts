import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { HeatmapCellVm } from '@/app/models';

/**
 * Intensity ramp, jade-based. The redesign keeps the affirmative accent here
 * rather than the brand one: a filled day is a positive reading, and
 * periwinkle stays reserved for voice / AI / primary action.
 *
 * Five stops to match `HeatmapCellVm['intensity']` (0–4).
 */
const LEVEL_BACKGROUNDS = [
  'rgba(255, 255, 255, 0.07)',
  'rgba(255, 255, 255, 0.14)',
  'rgba(63, 182, 143, 0.3)',
  'rgba(63, 182, 143, 0.6)',
  'var(--vox-jade)',
] as const;

/** Legend swatches — the ramp without the two lowest steps collapsed. */
const LEGEND_BACKGROUNDS = [
  LEVEL_BACKGROUNDS[0],
  LEVEL_BACKGROUNDS[2],
  LEVEL_BACKGROUNDS[3],
  LEVEL_BACKGROUNDS[4],
] as const;

/**
 * Activity heatmap — weeks as columns, days as rows.
 *
 * Takes the already-computed `HeatmapCellVm[]` that the Profile page builds,
 * so the date maths stays in one place instead of being duplicated here.
 */
@Component({
  selector: 'vox-heatmap',
  standalone: true,
  templateUrl: './vox-heatmap.component.html',
  styleUrl: './vox-heatmap.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxHeatmapComponent {
  readonly cells = input.required<readonly HeatmapCellVm[]>();
  readonly weeks = input(26);

  protected readonly legendBackgrounds = LEGEND_BACKGROUNDS;

  /** Chunked into columns of 7 so the template renders a real week grid. */
  protected readonly columns = computed(() => {
    const all = this.cells();
    const out: (HeatmapCellVm | null)[][] = [];
    for (let w = 0; w < this.weeks(); w++) {
      const col: (HeatmapCellVm | null)[] = [];
      for (let d = 0; d < 7; d++) {
        col.push(all[w * 7 + d] ?? null);
      }
      out.push(col);
    }
    return out;
  });

  protected background(cell: HeatmapCellVm | null): string {
    if (!cell) return LEVEL_BACKGROUNDS[0];
    return LEVEL_BACKGROUNDS[cell.intensity] ?? LEVEL_BACKGROUNDS[0];
  }
}
