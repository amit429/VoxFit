import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { addIcons } from 'ionicons';
import { chevronDownOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxPlanExerciseRowComponent } from '@/app/components/vox-plan-exercise-row/vox-plan-exercise-row.component';
import type { WorkoutPlanDay } from '@/app/models';

addIcons({ chevronDownOutline });

/**
 * One day of the week as a collapsible card.
 *
 * The coloured left rail and the matching number tile are keyed off the day's
 * `focus`, which is what turns a stack of identical grey pills into something
 * scannable — you find leg day by its colour before you read a word.
 *
 * Expansion state is owned by the parent so the accordion can stay
 * single-expand: on a five- or six-day plan, several open days produce a scroll
 * long enough that you lose track of where you are.
 */
@Component({
  selector: 'vox-plan-day',
  standalone: true,
  imports: [NgClass, VoxIconComponent, VoxPlanExerciseRowComponent],
  templateUrl: './vox-plan-day.component.html',
  styleUrl: './vox-plan-day.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxPlanDayComponent {
  readonly day = input.required<WorkoutPlanDay>();
  readonly expanded = input(false);

  readonly toggled = output<void>();

  /**
   * Collapsed, the subtitle sells the day: "Push focus · chest, shoulders,
   * triceps". Expanded, the muscle list is redundant — the exercises are right
   * there — so it gives way to the count and duration, which the collapsed row
   * carried on its right edge. Trading rather than appending keeps the line to
   * one row at 390px, which appending does not.
   */
  protected readonly subtitle = computed(() => {
    const day = this.day();
    if (!this.expanded()) return day.subtitle;
    const count = day.exercises.length;
    const lead = day.subtitle.split('·')[0].trim();
    const parts = [lead, `${count} ${count === 1 ? 'exercise' : 'exercises'}`];
    if (day.est_minutes) parts.push(`~${day.est_minutes} min`);
    return parts.filter(Boolean).join(' · ');
  });
}
