import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { addIcons } from 'ionicons';
import { barbellOutline, flagOutline, sparkles, timeOutline } from 'ionicons/icons';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxPlanFocusBarComponent } from '@/app/components/vox-plan-focus-bar/vox-plan-focus-bar.component';
import type { WorkoutPlanContent } from '@/app/models';

addIcons({ barbellOutline, flagOutline, sparkles, timeOutline });

/**
 * The plan's identity card: what this plan is, in one screenful above the fold.
 *
 * Before this existed the screen opened on a wall of rationale prose and the
 * user had no way to answer "how many days, what goal, how long a session" —
 * every one of those is a chip here, and the focus bar answers "what shape".
 */
@Component({
  selector: 'vox-plan-hero',
  standalone: true,
  imports: [VoxBadgeComponent, VoxIconComponent, VoxPlanFocusBarComponent],
  templateUrl: './vox-plan-hero.component.html',
  styleUrl: './vox-plan-hero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxPlanHeroComponent {
  readonly plan = input.required<WorkoutPlanContent>();
  /** ISO timestamp of when the plan was generated. Empty for an unsaved preview. */
  readonly createdAt = input<string | null>(null);

  protected readonly createdLabel = computed(() => {
    const raw = this.createdAt();
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  });

  protected readonly sessionLabel = computed(() => {
    const minutes = this.plan().est_session_minutes;
    return minutes ? `~${minutes} min` : '';
  });
}
