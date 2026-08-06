import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/* Half-ring geometry: a 66px-radius arc sweeping 180° from (14,92) to (146,92). */
const CX = 80;
const CY = 92;
const R = 66;
const ARC_LENGTH = Math.PI * R;

/**
 * The "sessions this week" half-ring on Profile. Jade because it reports
 * progress toward a target the user has already committed to — an
 * affirmative reading, not a warning when short.
 */
@Component({
  selector: 'vox-activity-ring',
  standalone: true,
  templateUrl: './vox-activity-ring.component.html',
  styleUrl: './vox-activity-ring.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxActivityRingComponent {
  readonly done = input.required<number>();
  readonly target = input.required<number>();
  /** Caption under the figure. Callers phrase it as an invitation, not a scold. */
  readonly caption = input('');

  protected readonly arcLength = ARC_LENGTH;

  protected readonly ratio = computed(() => {
    const t = this.target();
    if (t <= 0) return 0;
    return Math.max(0, Math.min(1, this.done() / t));
  });

  protected readonly dashOffset = computed(() => ARC_LENGTH * (1 - this.ratio()));

  /** Full 180° background arc, drawn once. */
  protected readonly trackPath = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
}
