import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { addIcons } from 'ionicons';
import { bulbOutline, handLeftOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import type { WorkoutPlanExercise } from '@/app/models';

addIcons({ bulbOutline, handLeftOutline });

/**
 * One prescribed exercise, in three tiers: name, prescription, start load.
 *
 * The prescription is mono and right-aligned so the numbers stack into a
 * scannable column down the day — that column is the reason the row is a row
 * and not a card. Rows separate with a hairline for the same reason: five
 * nested cards inside a day card is more chrome than content.
 */
@Component({
  selector: 'vox-plan-exercise-row',
  standalone: true,
  imports: [VoxIconComponent],
  templateUrl: './vox-plan-exercise-row.component.html',
  styleUrl: './vox-plan-exercise-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxPlanExerciseRowComponent {
  readonly exercise = input.required<WorkoutPlanExercise>();

  /** `3 × 10–12`, or `3 sets` when the model gave no rep range. */
  protected readonly prescription = computed(() => {
    const { sets, rep_range: reps } = this.exercise();
    if (!reps) return `${sets} ${sets === 1 ? 'set' : 'sets'}`;
    return `${sets} × ${reps}`;
  });

  protected readonly isCaution = computed(() => this.exercise().note_type === 'caution');
}
