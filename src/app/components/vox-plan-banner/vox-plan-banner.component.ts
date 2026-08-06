import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

export type VoxPlanBannerState = 'active' | 'rest-day' | 'no-plan';

/**
 * Today's-plan banner for the Train tab.
 *
 * `active` and `rest-day` are informational and navigate; `no-plan` is the
 * only state carrying a CTA, in apricot — generating a plan is the one action
 * worth interrupting for, and apricot marks gentle urgency without shouting.
 */
@Component({
  selector: 'vox-plan-banner',
  standalone: true,
  imports: [NgClass, VoxIconComponent],
  templateUrl: './vox-plan-banner.component.html',
  styleUrl: './vox-plan-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxPlanBannerComponent {
  readonly state = input.required<VoxPlanBannerState>();
  /** Main line — session name for `active`, ignored for the other states. */
  readonly title = input('');
  /** Supporting line, e.g. `Week 2 of 6 · ~52 min`. */
  readonly meta = input('');
  readonly generating = input(false);

  readonly open = output<void>();
  readonly generate = output<void>();
}
