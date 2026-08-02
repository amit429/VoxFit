import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';
import type { TrainingStatsSummary, WorkoutPlanGenerateResult } from '@/app/models';
import { WorkoutPlanService } from '@/app/services/workout-plan.service';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { PlanReviewCardComponent } from '@/app/components/plan-review-card/plan-review-card.component';

addIcons({ chevronBackOutline });

/** `/tabs/workout/plan` — generate/review/active states for the AI training plan. */
@Component({
  selector: 'app-workout-plan',
  standalone: true,
  templateUrl: './workout-plan.page.html',
  styleUrls: ['./workout-plan.page.scss'],
  imports: [RouterLink, IonContent, IonSpinner, VoxIconComponent, PlanReviewCardComponent],
})
export class WorkoutPlanPage implements ViewWillEnter {
  protected readonly planService = inject(WorkoutPlanService);

  protected readonly loadingActive = signal(true);
  protected readonly generating = signal(false);
  protected readonly review = signal<WorkoutPlanGenerateResult | null>(null);
  protected readonly error = signal<string | null>(null);

  /** User-chosen training days/week for the next generation. */
  protected readonly dayOptions = [3, 4, 5, 6] as const;
  protected readonly daysPerWeek = signal<number>(5);

  async ionViewWillEnter(): Promise<void> {
    this.loadingActive.set(true);
    this.error.set(null);
    this.review.set(null);
    try {
      await this.planService.getActivePlan();
    } catch (err) {
      console.error('[WorkoutPlanPage] load active plan', err);
      this.error.set(err instanceof Error ? err.message : 'Could not load your plan');
    } finally {
      this.loadingActive.set(false);
    }
  }

  protected async generate(): Promise<void> {
    this.error.set(null);
    this.generating.set(true);
    try {
      this.review.set(await this.planService.generate(this.daysPerWeek()));
    } catch (err) {
      console.error('[WorkoutPlanPage] generate', err);
      this.error.set(err instanceof Error ? err.message : 'Could not generate a plan — try again in a moment');
    } finally {
      this.generating.set(false);
    }
  }

  protected async save(): Promise<void> {
    const result = this.review();
    if (!result) return;
    this.error.set(null);
    try {
      await this.planService.save(result, 'on_demand');
      this.review.set(null);
    } catch (err) {
      console.error('[WorkoutPlanPage] save', err);
      this.error.set(err instanceof Error ? err.message : 'Could not save your plan');
    }
  }

  protected discard(): void {
    this.review.set(null);
  }

  /** One-line explanation of what the plan was built from, for the UI. */
  protected buildBasis(snapshot: TrainingStatsSummary | null | undefined, dayCount: number): string {
    const sessions = snapshot?.sessionsInWindow ?? 0;
    const goal = snapshot?.goal;
    const goalText = goal ? `your goal to ${goal}` : 'your goal';
    const dayText = `${dayCount}-day plan`;
    return sessions > 0
      ? `${dayText} built from ${goalText} + ${sessions} recent session${sessions === 1 ? '' : 's'}.`
      : `${dayText} built from ${goalText} — log a few workouts and I'll tailor it further.`;
  }
}
