import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

/**
 * Tones are role-assigned, matching the accent roles in variables.scss:
 * `jade` = selected/affirmative, `brand` = AI/brand, `apricot` = streak/PR,
 * `rose` = physical notes. `neutral` is the resting chip.
 *
 * `success` / `warning` / `danger` are retained as aliases of jade / apricot /
 * rose so existing call sites keep working; prefer the role names in new code.
 */
export type VoxBadgeTone =
  | 'neutral'
  | 'brand'
  | 'jade'
  | 'apricot'
  | 'rose'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';
export type VoxBadgeShape = 'sm' | 'pill';
export type VoxBadgeSize = 'xs' | 'md';

/** Shared chip/pill — status labels, filters, mood tags, PR markers. */
@Component({
  selector: 'vox-badge',
  standalone: true,
  imports: [NgClass],
  templateUrl: './vox-badge.component.html',
  styleUrl: './vox-badge.component.scss',
})
export class VoxBadgeComponent {
  readonly tone = input<VoxBadgeTone>('neutral');
  readonly shape = input<VoxBadgeShape>('pill');
  readonly size = input<VoxBadgeSize>('md');
}
