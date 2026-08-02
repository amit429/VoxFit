import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { IonContent, IonRouterLinkWithHref } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  flameOutline,
  micOutline,
  restaurantOutline,
  statsChartOutline,
  flashOutline,
  sparklesOutline,
  barbellOutline,
} from 'ionicons/icons';
import { DUMMY_PROFILE_DISPLAY } from '@/app/data';
import { AuthService } from '@/app/services/auth.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { NutritionDashboardService } from '@/app/services/nutrition-dashboard.service';
import { ProgressCoachService } from '@/app/services/progress-coach.service';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import { CoachPointerCardComponent } from '@/app/components/coach-pointer-card/coach-pointer-card.component';
import { voxfitMic } from '@/app/components/vox-icon/voxfit-icons';

addIcons({
  flameOutline,
  micOutline,
  restaurantOutline,
  statsChartOutline,
  flashOutline,
  sparklesOutline,
  barbellOutline,
  voxfitMic,
});

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    IonContent,
    RouterLink,
    IonRouterLinkWithHref,
    VoxIconComponent,
    VoxSkeletonComponent,
    CoachPointerCardComponent,
  ],
})
export class HomePage implements ViewWillEnter {
  protected readonly auth = inject(AuthService);
  protected readonly journal = inject(WorkoutJournalService);
  protected readonly nutrition = inject(NutritionDashboardService);
  protected readonly coach = inject(ProgressCoachService);

  protected readonly showSkeleton = computed(
    () => !this.journal.activityLoaded() || !this.journal.weekSessionsLoaded() || !this.nutrition.hasLoadedOnce(),
  );

  protected readonly macros = computed(() => this.nutrition.macros());

  protected readonly caloriesRow = computed(() => this.macros().rows.find((r) => r.label === 'Calories') ?? null);

  protected readonly macroTiles = computed(() => {
    const rows = this.macros().rows;
    const cal = rows.find((r) => r.label === 'Calories');
    const remaining = cal ? Math.max(0, cal.target - cal.current) : 0;
    return [
      ...rows
        .filter((r) => r.label !== 'Calories')
        .map((r) => ({ label: r.label, value: r.current, unit: 'g', accent: false })),
      { label: 'Rem', value: remaining, unit: '', accent: true },
    ];
  });

  protected readonly todayLabel = signal(
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
  );

  protected readonly firstName = computed(() => {
    const n = this.auth.profile()?.display_name?.trim();
    if (n) return n.split(/\s+/)[0] ?? n;
    return DUMMY_PROFILE_DISPLAY.name.split(/\s+/)[0] ?? 'Athlete';
  });

  protected readonly greeting = computed(() => `${this.pickGreeting()}, ${this.firstName()}`);

  protected readonly showReviewPointer = computed(() => {
    const r = this.coach.latestReview();
    return !!r && !r.acknowledged_at;
  });

  protected readonly showNudgePointer = computed(() => {
    const n = this.coach.latestNudge();
    return !!n && !n.acknowledged_at;
  });

  protected readonly initial = computed(() => {
    const n = this.auth.profile()?.display_name?.trim();
    if (n) return n.charAt(0).toUpperCase();
    return DUMMY_PROFILE_DISPLAY.initial;
  });

  ionViewWillEnter(): void {
    void this.journal.refreshActivitySummary();
    void this.journal.refreshCurrentWeekSessions();
    void this.nutrition.refresh();
    void this.auth.refreshProfile();
    void this.coach.getLatest();
  }

  private pickGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
