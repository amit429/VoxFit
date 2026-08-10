import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { addIcons } from 'ionicons';
import { handLeftOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import type { WorkoutPlanAccommodation } from '@/app/models';

/** Trailing words that describe the flag rather than name the body part. */
const REASON_SUFFIX = /\s*\b(discomfort|pain|injury|injuries|issue|issues|niggle|niggles|strain|tightness|flare[- ]?ups?)\b\s*$/i;

/**
 * The "built around your shoulder" callout.
 *
 * This is the actionable half of what used to be paragraph four of the
 * rationale. It sits above the rationale card because a user who changed the
 * plan by mentioning a sore shoulder should see that acknowledged first — and
 * it renders nothing at all when there is nothing to acknowledge, rather than
 * leaving an empty frame.
 */
@Component({
  selector: 'vox-plan-accommodation',
  standalone: true,
  imports: [VoxIconComponent],
  templateUrl: './vox-plan-accommodation.component.html',
  styleUrl: './vox-plan-accommodation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxPlanAccommodationComponent {
  readonly accommodations = input.required<readonly WorkoutPlanAccommodation[]>();

  protected readonly heading = computed(() => {
    const all = this.accommodations();
    if (all.length !== 1) return 'Built around your notes';
    const reason = all[0].reason.replace(REASON_SUFFIX, '').trim();
    return reason ? `Built around your ${reason.toLowerCase()}` : 'Built around your notes';
  });

  protected readonly body = computed(() => {
    const total = this.accommodations().reduce((n, a) => n + a.affected_count, 0);
    if (total <= 0) return 'Some exercises were swapped or capped. Look for the note on each.';
    const noun = total === 1 ? 'exercise was' : 'exercises were';
    return `${total} ${noun} swapped or capped. Look for the note on each.`;
  });

  /** Only worth listing the individual reasons when the heading had to generalise. */
  protected readonly showReasons = computed(() => this.accommodations().length > 1);
}
