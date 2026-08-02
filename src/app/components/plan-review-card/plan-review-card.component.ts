import { Component, input } from '@angular/core';
import type { WorkoutPlanContent } from '@/app/models';

/**
 * Presentational card that renders a `WorkoutPlanContent` — day-by-day
 * exercise prescriptions plus the AI's rationale. Used both for a
 * just-generated (unsaved) result and for the persisted active plan, so it
 * takes plain inputs rather than reading a service.
 */
@Component({
  selector: 'vox-plan-review-card',
  standalone: true,
  templateUrl: './plan-review-card.component.html',
  styleUrl: './plan-review-card.component.scss',
})
export class PlanReviewCardComponent {
  readonly plan = input.required<WorkoutPlanContent>();
  readonly rationale = input<string>('');
}
