import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

/**
 * `glass` is the default surface. The accent variants are role-assigned, not
 * decorative — `brand` marks AI-authored content, `jade` affirmative results,
 * `apricot` streak/PR content, `rose` physical notes. Never pick one because
 * it looks nice in that spot.
 */
export type VoxCardVariant = 'glass' | 'brand' | 'jade' | 'apricot' | 'rose';
export type VoxCardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Shared surface wrapper. Separation from the canvas comes from the hairline
 * border plus the `--vox-rim-light` top overlay, not from a shadow or a glow.
 */
@Component({
  selector: 'vox-card',
  standalone: true,
  imports: [NgClass],
  templateUrl: './vox-card.component.html',
  styleUrl: './vox-card.component.scss',
})
export class VoxCardComponent {
  readonly variant = input<VoxCardVariant>('glass');
  readonly padding = input<VoxCardPadding>('md');
  /** Adds press feedback. Set on cards that navigate or open a sheet. */
  readonly interactive = input(false);
}
