import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';

export type VoxStreakPillState = 'active' | 'dormant' | 'at-risk';

/**
 * Streak pill for the Home top bar. Apricot is the assigned streak accent;
 * the at-risk state stays apricot-adjacent rose rather than becoming an alert
 * red — a lapsed streak is not an error condition.
 *
 * Pass `days` and let the component derive its own state, or override with
 * `state` when the caller knows better (e.g. a same-day-deadline warning).
 */
@Component({
  selector: 'vox-streak-pill',
  standalone: true,
  imports: [NgClass],
  templateUrl: './vox-streak-pill.component.html',
  styleUrl: './vox-streak-pill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxStreakPillComponent {
  readonly days = input<number>(0);
  /** Explicit override; omit to derive from `days`. */
  readonly state = input<VoxStreakPillState | null>(null);

  protected readonly resolvedState = computed<VoxStreakPillState>(
    () => this.state() ?? (this.days() > 0 ? 'active' : 'dormant'),
  );

  protected readonly emoji = computed(() => {
    switch (this.resolvedState()) {
      case 'active':
        return '🔥';
      case 'at-risk':
        return '⚠️';
      default:
        return '💤';
    }
  });

  protected readonly text = computed(() => {
    const d = this.days();
    switch (this.resolvedState()) {
      case 'active':
        return d === 1 ? 'day streak' : 'day streak';
      case 'at-risk':
        return d === 1 ? 'day left to save it' : 'days left to save it';
      default:
        return 'Start a streak today';
    }
  });

  protected readonly showCount = computed(() => this.resolvedState() !== 'dormant');
}
