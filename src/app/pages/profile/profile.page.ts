import { ProgressReviewCardComponent } from '@/app/components/progress-review-card/progress-review-card.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import { Component, computed, inject, signal } from '@angular/core';
import { NavController } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  flagOutline,
  flameOutline,
  nutritionOutline,
  leafOutline,
  waterOutline,
  barbellOutline,
  settingsOutline,
} from 'ionicons/icons';
import { DUMMY_PROFILE_DISPLAY } from '@/app/data/profile.mock';
import type { GoalType, HeatmapCellVm, MonthlyBarVm, MonthlyChartStatVm } from '@/app/models';
import { AuthService } from '@/app/services/auth.service';
import { NutritionDashboardService } from '@/app/services/nutrition-dashboard.service';
import { ProgressCoachService } from '@/app/services/progress-coach.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import {
  buildMonthlySeries,
  getCurrentWeekDayKeys,
  getLastNMonthKeys,
  monthLongLabel,
  monthShortLabel,
  parseLocalDateKey,
} from '@/app/utils/workout-display.util';

addIcons({
  flagOutline,
  flameOutline,
  nutritionOutline,
  leafOutline,
  waterOutline,
  barbellOutline,
  settingsOutline,
});

const HEATMAP_WEEKS = 26;
const MONTHLY_CHART_MONTHS = 6;

/** Success-based ramp, never the accent — matches this design system's own heatmap convention. */
const HEATMAP_BACKGROUNDS = [
  'var(--vox-surface-2)',
  'var(--vox-surface-4)',
  'var(--vox-success-dim)',
  'color-mix(in oklab, var(--vox-success) 55%, var(--vox-success-dim))',
  'var(--vox-success)',
] as const;

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [VoxIconComponent, VoxSkeletonComponent, IonContent, IonSpinner, ProgressReviewCardComponent],
})
export class ProfilePage implements ViewWillEnter {
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  protected readonly journal = inject(WorkoutJournalService);
  private readonly nutrition = inject(NutritionDashboardService);
  protected readonly coach = inject(ProgressCoachService);

  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly profile = this.auth.profile;

  protected readonly showSkeleton = computed(
    () => !this.journal.activityLoaded() || !this.nutrition.monthlyHistoryLoaded(),
  );

  /** All-time exact counts (Workouts, PRs) — fetched once per page load via count-only queries. */
  protected readonly allTimeCounts = signal({ workouts: 0, prs: 0 });

  protected readonly heatmapSkeletonCells = Array.from({ length: HEATMAP_WEEKS * 7 }, (_, i) => i);
  protected readonly profileChartSkeletonBars = Array.from({ length: MONTHLY_CHART_MONTHS }, (_, i) => i);

  /** Oldest→newest window for both monthly charts below — captured once per page load. */
  private readonly monthKeys = getLastNMonthKeys(MONTHLY_CHART_MONTHS);
  private readonly monthLabels = this.monthKeys.map(monthShortLabel);

  /** Workouts / Streak / PRs hero stats — Workouts/PRs from all-time count queries, Streak from the bounded activity window. */
  protected readonly heroStats = computed(() => {
    const counts = this.allTimeCounts();
    return [
      { label: 'Workouts', value: counts.workouts },
      { label: 'Streak', value: this.journal.streak().days },
      { label: 'PRs', value: counts.prs },
    ];
  });

  /** 52 weeks × 7 days, oldest-first, flattened column-major so `grid-flow-col` renders it directly. */
  protected readonly heatmapCells = computed((): HeatmapCellVm[] => {
    const counts = new Map<string, number>();
    for (const s of this.journal.activityRows()) {
      if (!s.date) continue;
      counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
    }

    const today = new Date();
    const todayKey = parseLocalDateKey(today);
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    const gridStart = new Date(currentWeekStart);
    gridStart.setDate(currentWeekStart.getDate() - (HEATMAP_WEEKS - 1) * 7);

    const cells: HeatmapCellVm[] = [];
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + w * 7 + d);
        const key = parseLocalDateKey(date);
        cells.push({ key, intensity: intensityForCount(counts.get(key) ?? 0), isToday: key === todayKey });
      }
    }
    return cells;
  });

  protected readonly heatmapLegendColors = HEATMAP_BACKGROUNDS;

  protected heatmapCellBackground(cell: HeatmapCellVm): string {
    return HEATMAP_BACKGROUNDS[cell.intensity];
  }

  /** Tapped bar per chart — null means "show the 6-month aggregate", set means "show that month's stat". */
  protected readonly selectedWorkoutMonthIdx = signal<number | null>(null);
  protected readonly selectedCalorieMonthIdx = signal<number | null>(null);

  /** Workout count per month, last 6 months — from the bounded `activityRows` window (no new fetch). */
  private readonly monthlyWorkoutValues = computed(() =>
    buildMonthlySeries(this.journal.activityRows(), (s) => s.date, () => 1, this.monthKeys),
  );

  /** Calorie total per month, last 6 months — from a scoped `diet_logs` fetch (see `nutrition.refreshMonthlyHistory`). */
  private readonly monthlyCalorieValues = computed(() =>
    buildMonthlySeries(this.nutrition.monthlyCalorieRows(), (r) => r.date, (r) => r.calories, this.monthKeys),
  );

  protected readonly monthlyWorkoutBars = computed((): MonthlyBarVm[] =>
    this.toBars(this.monthlyWorkoutValues(), this.selectedWorkoutMonthIdx()),
  );

  protected readonly monthlyCalorieBars = computed((): MonthlyBarVm[] =>
    this.toBars(this.monthlyCalorieValues(), this.selectedCalorieMonthIdx()),
  );

  /** Card header: 6-month total by default, or the tapped month's count once a bar is selected. */
  protected readonly workoutChartStat = computed((): MonthlyChartStatVm => {
    const values = this.monthlyWorkoutValues();
    const sel = this.selectedWorkoutMonthIdx();
    if (sel == null) {
      return { caption: 'Last 6 months', value: values.reduce((a, b) => a + b, 0), unit: 'WORKOUTS' };
    }
    const v = values[sel] ?? 0;
    return { caption: monthLongLabel(this.monthKeys[sel]), value: v, unit: v === 1 ? 'WORKOUT' : 'WORKOUTS' };
  });

  /** Card header: avg daily calories by default, or the tapped month's total once a bar is selected. */
  protected readonly calorieChartStat = computed((): MonthlyChartStatVm => {
    const sel = this.selectedCalorieMonthIdx();
    if (sel == null) {
      return { caption: 'Last 6 months', value: this.avgDailyCalories6mo(), unit: 'AVG CAL/DAY' };
    }
    const v = Math.round(this.monthlyCalorieValues()[sel] ?? 0);
    return { caption: monthLongLabel(this.monthKeys[sel]), value: v, unit: 'KCAL' };
  });

  private readonly avgDailyCalories6mo = computed(() => {
    const rows = this.nutrition.monthlyCalorieRows();
    if (rows.length === 0) return 0;
    const total = rows.reduce((sum, r) => sum + r.calories, 0);
    const first = this.monthKeys[0];
    const start = new Date(first.year, first.month0, 1);
    const days = Math.max(1, Math.round((Date.now() - start.getTime()) / 86_400_000) + 1);
    return Math.round(total / days);
  });

  /** Tap a bar to inspect that month; tap the same bar again to go back to the aggregate view. */
  protected toggleWorkoutMonth(i: number): void {
    this.selectedWorkoutMonthIdx.update((cur) => (cur === i ? null : i));
  }

  protected toggleCalorieMonth(i: number): void {
    this.selectedCalorieMonthIdx.update((cur) => (cur === i ? null : i));
  }

  private toBars(values: readonly number[], selectedIdx: number | null): MonthlyBarVm[] {
    const max = Math.max(...values, 1);
    const currentIdx = this.monthKeys.length - 1;
    return values.map((v, i) => ({
      heightPx: v <= 0 ? 4 : 8 + Math.round((v / max) * 44),
      label: this.monthLabels[i] ?? '?',
      isCurrent: i === currentIdx,
      isSelected: i === selectedIdx,
    }));
  }

  protected readonly goalRows = computed(() => {
    const p = this.profile();
    const weekKeys = new Set(getCurrentWeekDayKeys());
    const sessionsThisWeek = this.journal.activityRows().filter((s) => s.date && weekKeys.has(s.date)).length;

    const cals =
      p?.target_calories != null && p.target_calories > 0
        ? `${Math.round(p.target_calories).toLocaleString()} kcal`
        : 'Set targets in onboarding';
    const prot =
      p?.target_protein_g != null && p.target_protein_g > 0 ? `${Math.round(p.target_protein_g)} g` : '—';
    const carbs =
      p?.target_carbs_g != null && p.target_carbs_g > 0 ? `${Math.round(p.target_carbs_g)} g` : '—';
    const fat =
      p?.target_fat_g != null && p.target_fat_g > 0 ? `${Math.round(p.target_fat_g)} g` : '—';

    return [
      { icon: 'flame-outline', label: 'Daily Calories', value: cals },
      { icon: 'nutrition-outline', label: 'Protein Target', value: prot },
      { icon: 'leaf-outline', label: 'Carbs Target', value: carbs },
      { icon: 'water-outline', label: 'Fat Target', value: fat },
      { icon: 'barbell-outline', label: 'Workouts (this week)', value: `${sessionsThisWeek} logged` },
      { icon: 'flag-outline', label: 'Primary Goal', value: ProfilePage.formatGoalLabel(p?.goal ?? null) },
    ];
  });

  private static formatGoalLabel(goal: GoalType | null): string {
    if (!goal) return '—';
    if (goal === 'bulk') return 'Build muscle';
    if (goal === 'cut') return 'Fat loss';
    return 'Maintain';
  }

  protected readonly displayName = computed(() => {
    return this.profile()?.display_name?.trim() || DUMMY_PROFILE_DISPLAY.name;
  });

  protected readonly email = computed(() => {
    return this.profile()?.email?.trim() || this.auth.user()?.email || DUMMY_PROFILE_DISPLAY.email;
  });

  protected readonly avatarInitial = computed(() => {
    const n = this.displayName();
    return n.trim().charAt(0).toUpperCase() || DUMMY_PROFILE_DISPLAY.initial;
  });

  protected readonly sportChip = computed(() => {
    const s = this.profile()?.sport_type;
    if (!s) return DUMMY_PROFILE_DISPLAY.sportChip;
    if (s === 'gym') return 'Gym';
    if (s === 'runner') return 'Running';
    if (s === 'cyclist') return 'Cycling';
    return 'Athletics';
  });

  protected readonly goalChip = computed(() => {
    const g = this.profile()?.goal;
    if (!g) return DUMMY_PROFILE_DISPLAY.goalChip;
    return ProfilePage.formatGoalLabel(g);
  });

  ionViewWillEnter(): void {
    void this.auth.refreshProfile();
    void this.journal.refreshActivitySummary();
    void this.nutrition.refreshMonthlyHistory(MONTHLY_CHART_MONTHS);
    void this.loadAllTimeCounts();
    void this.coach.getLatest();
  }

  protected async checkProgress(): Promise<void> {
    this.error.set(null);
    this.generating.set(true);
    try {
      await this.coach.generate();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Check-in failed');
    } finally {
      this.generating.set(false);
    }
  }

  protected onAcknowledge(id: string): void {
    void this.coach.acknowledgeReview(id);
  }

  private async loadAllTimeCounts(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) {
      this.allTimeCounts.set({ workouts: 0, prs: 0 });
      return;
    }
    try {
      this.allTimeCounts.set(await this.journal.getAllTimeCounts(uid));
    } catch (err) {
      console.error('[ProfilePage] all-time counts', err);
    }
  }

  protected goToSettings(): void {
    this.navCtrl.navigateForward('/settings');
  }
}

function intensityForCount(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 4;
}
