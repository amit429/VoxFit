import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import type { WorkoutPlanDay, WorkoutPlanFocus } from '@/app/models';
import { WORKOUT_PLAN_FOCUSES, WORKOUT_PLAN_FOCUS_LABELS } from '@/app/models';

interface FocusSlice {
  readonly focus: WorkoutPlanFocus;
  readonly label: string;
  readonly count: number;
}

/**
 * Stacked proportion bar showing how the week splits across day types.
 *
 * This is the piece that makes a plan legible at a glance — "two push, two
 * legs, one recovery" lands before any day title is read. It is built from the
 * `focus` enum rather than by parsing day titles, so a plan whose titles are
 * phrased unusually still charts correctly.
 */
@Component({
  selector: 'vox-plan-focus-bar',
  standalone: true,
  imports: [NgClass],
  templateUrl: './vox-plan-focus-bar.component.html',
  styleUrl: './vox-plan-focus-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxPlanFocusBarComponent {
  readonly days = input.required<readonly WorkoutPlanDay[]>();

  /** Counts per focus, in the canonical enum order so the legend never reshuffles. */
  protected readonly slices = computed<FocusSlice[]>(() => {
    const counts = new Map<WorkoutPlanFocus, number>();
    for (const day of this.days()) {
      counts.set(day.focus, (counts.get(day.focus) ?? 0) + 1);
    }
    return WORKOUT_PLAN_FOCUSES.filter((f) => counts.has(f)).map((focus) => ({
      focus,
      label: WORKOUT_PLAN_FOCUS_LABELS[focus],
      count: counts.get(focus) ?? 0,
    }));
  });

  /** Screen readers get the same summary the bar conveys visually. */
  protected readonly summary = computed(() =>
    this.slices()
      .map((s) => `${s.count} ${s.label.toLowerCase()}`)
      .join(', '),
  );
}
