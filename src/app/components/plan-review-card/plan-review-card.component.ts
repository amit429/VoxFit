import { Component, input, signal } from '@angular/core';
import { addIcons } from 'ionicons';
import { chevronDownOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import type { WorkoutPlanContent } from '@/app/models';

addIcons({ chevronDownOutline });

/**
 * Presentational card that renders a `WorkoutPlanContent` — day-by-day
 * exercise prescriptions in collapsible accordions plus the AI's rationale.
 * Used both for a just-generated (unsaved) result and for the persisted active
 * plan, so it takes plain inputs rather than reading a service.
 */
@Component({
  selector: 'vox-plan-review-card',
  standalone: true,
  imports: [VoxIconComponent],
  templateUrl: './plan-review-card.component.html',
  styleUrl: './plan-review-card.component.scss',
})
export class PlanReviewCardComponent {
  readonly plan = input.required<WorkoutPlanContent>();
  readonly rationale = input<string>('');

  /** Indices of expanded days. Day 1 (index 0) starts open; the rest collapsed. */
  private readonly expanded = signal<ReadonlySet<number>>(new Set([0]));

  protected isOpen(index: number): boolean {
    return this.expanded().has(index);
  }

  protected toggle(index: number): void {
    const next = new Set(this.expanded());
    if (next.has(index)) next.delete(index);
    else next.add(index);
    this.expanded.set(next);
  }
}
