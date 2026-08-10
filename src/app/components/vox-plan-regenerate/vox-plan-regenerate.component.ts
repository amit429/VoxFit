import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { VoxSegmentedComponent } from '@/app/components/vox-segmented/vox-segmented.component';
import type { VoxSegment } from '@/app/models';

export type VoxPlanRegenerateMode = 'create' | 'regenerate';

const DAY_SEGMENTS: readonly VoxSegment[] = [
  { id: '3', label: '3' },
  { id: '4', label: '4' },
  { id: '5', label: '5' },
  { id: '6', label: '6' },
];

/**
 * The frequency picker plus the generate CTA — the screen's only action.
 *
 * In `regenerate` mode the consequence is stated in the card, not in the
 * confirm dialog that follows: the user is about to destroy a plan, and finding
 * that out after tapping is finding out too late. The 15-second expectation
 * line is doing the same job for the wait.
 */
@Component({
  selector: 'vox-plan-regenerate',
  standalone: true,
  imports: [VoxSegmentedComponent],
  templateUrl: './vox-plan-regenerate.component.html',
  styleUrl: './vox-plan-regenerate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxPlanRegenerateComponent {
  readonly mode = input<VoxPlanRegenerateMode>('regenerate');
  readonly daysPerWeek = input.required<number>();
  readonly busy = input(false);

  readonly daysPerWeekChange = output<number>();
  readonly generate = output<void>();

  protected readonly segments = DAY_SEGMENTS;

  protected readonly selected = computed(() => String(this.daysPerWeek()));

  protected readonly heading = computed(() =>
    this.mode() === 'create' ? 'Create your training plan' : 'Want a different plan?',
  );

  protected readonly copy = computed(() =>
    this.mode() === 'create'
      ? "I'll design a day-by-day plan around your goal and sport — using your recent sessions when you have them, and sensible starting movements when you don't."
      : 'Regenerating builds a fresh plan from your latest sessions. Your current plan is replaced.',
  );

  protected readonly cta = computed(() =>
    this.mode() === 'create' ? 'Generate my plan' : 'Regenerate plan',
  );

  protected onSegment(id: string): void {
    const next = Number(id);
    if (Number.isFinite(next)) this.daysPerWeekChange.emit(next);
  }
}
