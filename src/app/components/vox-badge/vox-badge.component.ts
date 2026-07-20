import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

export type VoxBadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export type VoxBadgeShape = 'sm' | 'pill';

/**
 * Shared status pill/tag — replaces the scattered
 * `rounded-lg px-3 py-1 text-xs font-bold` + inline `style="background: ..."`
 * pattern used for status labels, mood/energy tags, and PR/flag badges.
 */
@Component({
  selector: 'vox-badge',
  standalone: true,
  imports: [NgClass],
  templateUrl: './vox-badge.component.html',
  styleUrl: './vox-badge.component.scss',
})
export class VoxBadgeComponent {
  readonly tone = input<VoxBadgeTone>('neutral');
  readonly shape = input<VoxBadgeShape>('sm');
}
