import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

/** Which accent the figure is tinted with. `ink` is the neutral default. */
export type VoxStatTileTone = 'ink' | 'jade' | 'apricot' | 'brand' | 'rose';

/**
 * One cell of the 3-up stat row (session result, profile hero). Figures are
 * JetBrains Mono with tabular numerals so a row of tiles stays aligned as
 * values change.
 */
@Component({
  selector: 'vox-stat-tile',
  standalone: true,
  imports: [NgClass],
  templateUrl: './vox-stat-tile.component.html',
  styleUrl: './vox-stat-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxStatTileComponent {
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly tone = input<VoxStatTileTone>('ink');
}
