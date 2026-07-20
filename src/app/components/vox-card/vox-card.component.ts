import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

export type VoxCardVariant = 'resting' | 'raised' | 'interactive';
export type VoxCardPadding = 'none' | 'sm' | 'md';

/**
 * Shared surface wrapper — replaces the copy-pasted
 * `rounded-2xl border ... bg-[var(--vox-surface)] px-4 py-4` Tailwind
 * recipe repeated across home/workout/diet/voice-log pages.
 */
@Component({
  selector: 'vox-card',
  standalone: true,
  imports: [NgClass],
  templateUrl: './vox-card.component.html',
  styleUrl: './vox-card.component.scss',
})
export class VoxCardComponent {
  readonly variant = input<VoxCardVariant>('resting');
  readonly padding = input<VoxCardPadding>('md');
}
