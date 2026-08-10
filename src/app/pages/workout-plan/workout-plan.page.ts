import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, refreshOutline } from 'ionicons/icons';
import type { WorkoutPlanSource } from '@/app/models';
import { WorkoutPlanService } from '@/app/services/workout-plan.service';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxConfirmDialogComponent } from '@/app/components/vox-confirm-dialog/vox-confirm-dialog.component';
import { VoxPlanAccommodationComponent } from '@/app/components/vox-plan-accommodation/vox-plan-accommodation.component';
import { VoxPlanBuildingComponent } from '@/app/components/vox-plan-building/vox-plan-building.component';
import { VoxPlanDayComponent } from '@/app/components/vox-plan-day/vox-plan-day.component';
import { VoxPlanHeroComponent } from '@/app/components/vox-plan-hero/vox-plan-hero.component';
import { VoxPlanRationaleComponent } from '@/app/components/vox-plan-rationale/vox-plan-rationale.component';
import { VoxPlanRegenerateComponent } from '@/app/components/vox-plan-regenerate/vox-plan-regenerate.component';

addIcons({ chevronBackOutline, refreshOutline });

/** `/tabs/workout/plan` — the active training plan, and the one action that replaces it. */
@Component({
  selector: 'app-workout-plan',
  standalone: true,
  templateUrl: './workout-plan.page.html',
  styleUrls: ['./workout-plan.page.scss'],
  imports: [
    RouterLink,
    IonContent,
    VoxIconComponent,
    VoxSkeletonComponent,
    VoxConfirmDialogComponent,
    VoxPlanAccommodationComponent,
    VoxPlanBuildingComponent,
    VoxPlanDayComponent,
    VoxPlanHeroComponent,
    VoxPlanRationaleComponent,
    VoxPlanRegenerateComponent,
  ],
})
export class WorkoutPlanPage implements ViewWillEnter {
  protected readonly planService = inject(WorkoutPlanService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loadingActive = signal(true);
  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmOpen = signal(false);

  /** User-chosen training days/week for the next generation. */
  protected readonly daysPerWeek = signal<number>(5);

  /**
   * Which day is open, by `day` number. Single-expand: opening one closes the
   * rest. Multi-expand on a six-day plan produces a scroll long enough that you
   * lose your place, which is the problem the accordion exists to solve.
   * `null` — everything collapsed — is the default, so the hero and the shape
   * of the week are what the screen opens on.
   */
  protected readonly openDay = signal<number | null>(null);

  protected readonly totalExercises = computed(() => {
    const plan = this.planService.activePlan()?.plan;
    if (!plan) return 0;
    return plan.days.reduce((n, day) => n + day.exercises.length, 0);
  });

  /** Set when arriving via the Train tab's plan-nudge "refresh" CTA (`?refresh=nudge`). */
  private readonly saveSource = signal<WorkoutPlanSource>('on_demand');

  /**
   * One-shot guard for the `?refresh=nudge` auto-generate. `IonicRouteStrategy`
   * caches this page instance, so `ionViewWillEnter` re-fires on every re-entry —
   * without this, switching tabs away mid-generation and back would fire a second
   * Gemini call. The cleared query param is the primary defense (belt); this flag
   * is the suspenders in case a stale snapshot still carries it.
   */
  private nudgeRefreshConsumed = false;

  async ionViewWillEnter(): Promise<void> {
    this.loadingActive.set(true);
    this.error.set(null);
    const isNudgeRefresh = !this.nudgeRefreshConsumed && this.route.snapshot.queryParamMap.get('refresh') === 'nudge';
    try {
      const active = await this.planService.getActivePlan();
      // Default the picker to the plan the user is already on, so "regenerate"
      // without touching the segmented control reproduces the same frequency.
      if (active?.plan.days_per_week) this.daysPerWeek.set(active.plan.days_per_week);
    } catch (err) {
      console.error('[WorkoutPlanPage] load active plan', err);
      this.error.set(err instanceof Error ? err.message : 'Could not load your plan');
    } finally {
      this.loadingActive.set(false);
    }
    if (isNudgeRefresh) {
      this.nudgeRefreshConsumed = true;
      // Strip the query param immediately so a re-entry can't see it and
      // re-trigger this branch via the cached page instance.
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      await this.runGenerate('nudge_refresh');
    }
  }

  /**
   * Consent happens here, before the call — not after it. A user replacing a
   * plan they spent a week following should be told that before they wait 15
   * seconds, and the first generation has nothing to destroy, so it just runs.
   */
  protected requestGenerate(): void {
    if (this.planService.activePlan()) {
      this.confirmOpen.set(true);
      return;
    }
    void this.runGenerate('on_demand');
  }

  protected async confirmRegenerate(): Promise<void> {
    this.confirmOpen.set(false);
    await this.runGenerate('on_demand');
  }

  protected setDaysPerWeek(days: number): void {
    this.daysPerWeek.set(days);
  }

  protected toggleDay(day: number): void {
    this.openDay.update((current) => (current === day ? null : day));
  }

  /**
   * Generate and persist in one step. There is no review-and-save gate: the
   * confirm dialog already took consent, and a plan sitting on screen in a
   * "not yet saved" state is a distinction the user has no reason to track.
   * A failure leaves the previous plan untouched — `save()` only runs on success.
   */
  private async runGenerate(source: WorkoutPlanSource): Promise<void> {
    this.saveSource.set(source);
    this.error.set(null);
    this.generating.set(true);
    try {
      const result = await this.planService.generate(this.daysPerWeek());
      await this.planService.save(result, this.saveSource());
      this.openDay.set(null);
    } catch (err) {
      console.error('[WorkoutPlanPage] generate', err);
      this.error.set(err instanceof Error ? err.message : 'Could not generate a plan — try again in a moment');
    } finally {
      this.generating.set(false);
    }
  }
}
