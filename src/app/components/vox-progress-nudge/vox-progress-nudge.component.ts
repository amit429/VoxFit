import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

export type VoxProgressNudgeState = 'check-in-ready' | 'trending-up' | 'recurring-note';

/**
 * Coach nudge banner.
 *
 * `recurring-note` surfaces a physical note the user themself reported. It is
 * deliberately rose rather than red, carries no warning triangle or clinical
 * iconography, and its copy stays observational ("came up 4 times"), never
 * assessive. That framing is a product-safety requirement recorded in the AI
 * Coach PRD, not a style preference — do not restyle it as an alert.
 */
@Component({
  selector: 'vox-progress-nudge',
  standalone: true,
  imports: [NgClass, VoxIconComponent],
  templateUrl: './vox-progress-nudge.component.html',
  styleUrl: './vox-progress-nudge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxProgressNudgeComponent {
  readonly state = input.required<VoxProgressNudgeState>();
  readonly title = input.required<string>();
  readonly detail = input('');
  /** CTA label; omit to render the banner without an action. */
  readonly ctaLabel = input('');
  /** Short figure shown as a trailing chip, e.g. `+18%`. */
  readonly stat = input('');

  readonly action = output<void>();
}
