import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonModal } from '@ionic/angular/standalone';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import type { HomeStreakMock } from '@/app/models';

/**
 * Milestone celebration. Fires once per milestone — the host owns the
 * already-seen bookkeeping (see `StreakMilestoneService`), because this
 * component is presentational and a modal that decided its own visibility
 * would re-fire on every navigation back to the page.
 *
 * The mockup's "Share my streak" button is absent: there is no share-image
 * generation and no `@capacitor/share` in the app. See Deferred #8.
 */
@Component({
  selector: 'vox-streak-celebration',
  standalone: true,
  imports: [IonModal, VoxIconComponent],
  templateUrl: './vox-streak-celebration.component.html',
  styleUrl: './vox-streak-celebration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxStreakCelebrationComponent {
  readonly isOpen = input(false);
  readonly days = input.required<number>();
  /** Week completion dots from `WorkoutJournalService.streak()`. */
  readonly weekDots = input<HomeStreakMock['weekDots']>([]);

  readonly dismissed = output<void>();

  protected readonly headline = computed(() => {
    const d = this.days();
    if (d >= 100) return `${d} days straight.`;
    if (d >= 30) return 'A full month. Locked in 💪';
    if (d >= 14) return "Two weeks straight.\nYou're built different 💪";
    return `${d} days and counting 💪`;
  });

  protected readonly subline = computed(
    () => `That's ${this.days()} consecutive days with a logged session.`,
  );
}
