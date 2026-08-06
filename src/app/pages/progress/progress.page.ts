import { Component, computed, inject, signal } from '@angular/core';
import { NavController } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { IonContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';
import type {
  HeatmapCellVm,
  MonthlyChartStatVm,
  VoxTrendPoint,
  VoxVolumeBar,
} from '@/app/models';
import { AuthService } from '@/app/services/auth.service';
import { NutritionDashboardService } from '@/app/services/nutrition-dashboard.service';
import { WorkoutJournalService, TREND_WINDOW_WEEKS } from '@/app/services/workout-journal.service';
import { WorkoutPlanService } from '@/app/services/workout-plan.service';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import { VoxStatTileComponent } from '@/app/components/vox-stat-tile/vox-stat-tile.component';
import { VoxHeatmapComponent } from '@/app/components/vox-heatmap/vox-heatmap.component';
import { VoxActivityRingComponent } from '@/app/components/vox-activity-ring/vox-activity-ring.component';
import { VoxVolumeChartComponent } from '@/app/components/vox-volume-chart/vox-volume-chart.component';
import { VoxTrendChartComponent } from '@/app/components/vox-trend-chart/vox-trend-chart.component';
import {
  buildMonthlySeries,
  getCurrentWeekDayKeys,
  getLastNMonthKeys,
  monthLongLabel,
  monthShortLabel,
  parseLocalDateKey,
} from '@/app/utils/workout-display.util';

addIcons({ chevronBackOutline });

const HEATMAP_WEEKS = 26;
const MONTHLY_CHART_MONTHS = 6;

/**
 * Fallback weekly session target when the user has no active plan. There is
 * no configurable target in `user_profiles` — see Deferred #2.
 */
const DEFAULT_WEEKLY_TARGET = 5;

/**
 * Every chart and derived stat, on its own screen.
 *
 * Split out of Profile, which had grown to a dozen stacked cards — identity,
 * badges and preferences were competing with six charts for the same scroll.
 * Profile now links here instead.
 */
@Component({
  selector: 'app-progress',
  standalone: true,
  templateUrl: './progress.page.html',
  styleUrls: ['./progress.page.scss'],
  imports: [
    IonContent,
    VoxIconComponent,
    VoxCardComponent,
    VoxSkeletonComponent,
    VoxStatTileComponent,
    VoxHeatmapComponent,
    VoxActivityRingComponent,
    VoxVolumeChartComponent,
    VoxTrendChartComponent,
  ],
})
export class ProgressPage implements ViewWillEnter {
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  protected readonly journal = inject(WorkoutJournalService);
  private readonly nutrition = inject(NutritionDashboardService);
  private readonly planService = inject(WorkoutPlanService);

  protected readonly showSkeleton = computed(
    () => !this.journal.activityLoaded() || !this.nutrition.monthlyHistoryLoaded(),
  );

  protected readonly heatmapWeeks = HEATMAP_WEEKS;
  protected readonly trendWeeks = TREND_WINDOW_WEEKS;

  /** Tones for the three hero tiles: neutral / streak / PRs. */
  protected readonly statTones = ['ink', 'apricot', 'jade'] as const;

  /** All-time exact counts — count-only queries, no row data transferred. */
  protected readonly allTimeCounts = signal({ workouts: 0, prs: 0 });

  /** Oldest→newest window for both monthly charts — captured once per page load. */
  private readonly monthKeys = getLastNMonthKeys(MONTHLY_CHART_MONTHS);
  private readonly monthLabels = this.monthKeys.map(monthShortLabel);

  protected readonly heroStats = computed(() => {
    const counts = this.allTimeCounts();
    return [
      { label: 'Workouts', value: counts.workouts },
      { label: 'Streak', value: this.journal.streak().days },
      { label: 'PRs', value: counts.prs },
    ];
  });

  /** 26 weeks × 7 days, oldest-first, column-major so the grid renders directly. */
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

  // ---- Sessions this week ----

  protected readonly sessionsThisWeek = computed(() => {
    const weekKeys = new Set(getCurrentWeekDayKeys());
    return this.journal.activityRows().filter((s) => s.date && weekKeys.has(s.date)).length;
  });

  protected readonly weeklySessionTarget = computed(
    () => this.planService.activePlan()?.plan.days.length || DEFAULT_WEEKLY_TARGET,
  );

  protected readonly weeklyTargetCaption = computed(() => {
    const left = this.weeklySessionTarget() - this.sessionsThisWeek();
    if (left <= 0) return 'Target hit for the week 🎯';
    if (left === 1) return 'One more and you hit the target 🎯';
    return `${left} more to hit the target 🎯`;
  });

  // ---- This week's volume ----

  protected readonly weeklyVolumeBars = computed((): VoxVolumeBar[] => {
    const w = this.journal.weeklyVolume();
    const keys = getCurrentWeekDayKeys();
    const todayKey = parseLocalDateKey(new Date());
    return w.values.map((value, i) => ({
      label: w.dayLabels[i] ?? '?',
      value,
      isToday: keys[i] === todayKey,
    }));
  });

  protected readonly weeklyVolumeTotal = computed(() =>
    Math.round(this.journal.weeklyVolume().values.reduce((a, b) => a + b, 0)).toLocaleString(),
  );

  // ---- Monthly charts ----

  protected readonly selectedWorkoutMonthIdx = signal<number | null>(null);
  protected readonly selectedCalorieMonthIdx = signal<number | null>(null);

  private readonly monthlyWorkoutValues = computed(() =>
    buildMonthlySeries(this.journal.activityRows(), (s) => s.date, () => 1, this.monthKeys),
  );

  private readonly monthlyCalorieValues = computed(() =>
    buildMonthlySeries(this.nutrition.monthlyCalorieRows(), (r) => r.date, (r) => r.calories, this.monthKeys),
  );

  protected readonly monthlyWorkoutVolumeBars = computed((): VoxVolumeBar[] =>
    this.toVolumeBars(this.monthlyWorkoutValues()),
  );

  protected readonly monthlyCalorieVolumeBars = computed((): VoxVolumeBar[] =>
    this.toVolumeBars(this.monthlyCalorieValues()),
  );

  private toVolumeBars(values: readonly number[]): VoxVolumeBar[] {
    return values.map((value, i) => ({
      label: this.monthLabels[i] ?? '?',
      value,
      /* The last month in the window is the current one. */
      isToday: i === values.length - 1,
    }));
  }

  protected readonly workoutChartStat = computed((): MonthlyChartStatVm => {
    const values = this.monthlyWorkoutValues();
    const sel = this.selectedWorkoutMonthIdx();
    if (sel == null) {
      return { caption: 'Last 6 months', value: values.reduce((a, b) => a + b, 0), unit: 'WORKOUTS' };
    }
    const v = values[sel] ?? 0;
    return { caption: monthLongLabel(this.monthKeys[sel]), value: v, unit: v === 1 ? 'WORKOUT' : 'WORKOUTS' };
  });

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

  /** Tap a bar to inspect that month; tap again to return to the aggregate. */
  protected toggleWorkoutMonth(i: number): void {
    this.selectedWorkoutMonthIdx.update((cur) => (cur === i ? null : i));
  }

  protected toggleCalorieMonth(i: number): void {
    this.selectedCalorieMonthIdx.update((cur) => (cur === i ? null : i));
  }

  // ---- Strength trend ----

  protected readonly trendExercise = signal<string | null>(null);
  protected readonly trendPoints = signal<VoxTrendPoint[]>([]);

  protected readonly trendHeadline = computed(() => {
    const best = this.trendPoints().reduce((max, p) => Math.max(max, p.value), 0);
    return best > 0 ? `${best} kg` : '';
  });

  ionViewWillEnter(): void {
    void this.journal.refreshActivitySummary();
    void this.journal.refreshCurrentWeekSessions();
    void this.nutrition.refreshMonthlyHistory(MONTHLY_CHART_MONTHS);
    void this.loadAllTimeCounts();
    void this.loadTrend();
    this.planService.getActivePlan().catch((err) => console.error('[ProgressPage] load active plan', err));
  }

  protected goBack(): void {
    this.navCtrl.navigateBack('/tabs/profile');
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
      console.error('[ProgressPage] all-time counts', err);
    }
  }

  private async loadTrend(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    try {
      /*
       * Walk the most-logged exercises until one yields a plottable series.
       * The most frequent lift is often bodyweight (push-ups, pull-ups), which
       * has no top-set weight — charting its title over an empty state reads
       * as a bug rather than as missing data.
       */
      const top = await this.journal.listTopExercises(uid);
      for (const candidate of top) {
        const series = await this.journal.getExerciseTrend(uid, candidate);
        if (series.length < 2) continue;
        this.trendExercise.set(candidate);
        this.trendPoints.set(
          series.map((s, i) => ({
            label: i === series.length - 1 ? 'NOW' : `W${i + 1}`,
            value: s.topWeightKg,
            isPr: s.isPr,
          })),
        );
        return;
      }
      this.trendExercise.set(null);
      this.trendPoints.set([]);
    } catch (err) {
      console.error('[ProgressPage] load trend', err);
      this.trendExercise.set(null);
      this.trendPoints.set([]);
    }
  }
}

function intensityForCount(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 4;
}
