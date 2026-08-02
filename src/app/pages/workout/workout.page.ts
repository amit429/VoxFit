import { PlanNudgeCardComponent } from '@/app/components/plan-nudge-card/plan-nudge-card.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonModal,
  IonButton,
  IonSpinner,
} from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, trophyOutline, warningOutline } from 'ionicons/icons';
import type { WorkoutSessionListMock, WorkoutSessionListRow, WorkoutSessionRow } from '@/app/models';
import { AuthService } from '@/app/services/auth.service';
import { ProgressCoachService } from '@/app/services/progress-coach.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { WorkoutPlanService } from '@/app/services/workout-plan.service';
import {
  formatSessionDateLabel,
  getCurrentWeekDayKeys,
  parseLocalDateKey,
  parseIsoDateLocal,
  sessionTotalVolumeKg,
} from '@/app/utils/workout-display.util';

addIcons({ chevronBackOutline, chevronForwardOutline, trophyOutline, warningOutline });

@Component({
  selector: 'app-workout',
  standalone: true,
  templateUrl: './workout.page.html',
  styleUrls: ['./workout.page.scss'],
  imports: [
    PlanNudgeCardComponent,
    VoxIconComponent,
    VoxSkeletonComponent,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonModal,
    IonButton,
    IonSpinner,
  ],
})
export class WorkoutPage implements ViewWillEnter {
  protected readonly journal = inject(WorkoutJournalService);
  protected readonly planService = inject(WorkoutPlanService);
  protected readonly coach = inject(ProgressCoachService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly activeFilter = signal<'all' | 'week' | 'prs' | 'month' | 'dates'>('week');
  protected readonly monthPickerOpen = signal(false);
  /** Year shown in the month-picker modal (browse). */
  protected readonly monthPickYear = signal<number>(new Date().getFullYear());
  /** Calendar month for the “Month” journal filter (local). */
  protected readonly journalMonth = signal<{ year: number; month0: number }>(
    (() => {
      const n = new Date();
      return { year: n.getFullYear(), month0: n.getMonth() };
    })(),
  );

  protected readonly dateFilterOpen = signal(false);
  /** Single calendar day vs inclusive from–to range. */
  protected readonly dateFilterSubMode = signal<'single' | 'range'>('single');
  protected readonly singleDateKey = signal<string>(parseLocalDateKey(new Date()));
  protected readonly rangeFromKey = signal<string>(parseLocalDateKey(new Date()));
  protected readonly rangeToKey = signal<string>(parseLocalDateKey(new Date()));

  /** `month`/`dates` filter results — own scoped fetch, independent of the shared week cache. */
  protected readonly rangeSessions = signal<WorkoutSessionRow[]>([]);
  protected readonly rangeLoading = signal(false);
  protected readonly rangeError = signal<string | null>(null);

  /** `all`/`prs` filter results — paginated, never loads full history at once. */
  protected readonly journalPageItems = signal<WorkoutSessionListRow[]>([]);
  protected readonly journalHasMore = signal(true);
  protected readonly journalPageLoading = signal(false);
  protected readonly journalPageError = signal<string | null>(null);

  /** Previous calendar week's strength tonnage — for the week-over-week % stat. Null until fetched or if no prior volume. */
  protected readonly prevWeekVolumeKg = signal<number | null>(null);

  /** 3-letter labels for the month grid (12 months). */
  protected readonly monthGridLabels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ] as const;

  protected readonly filters = [
    { id: 'week' as const, label: 'This week' },
    { id: 'all' as const, label: 'All' },
    { id: 'prs' as const, label: 'PRs' },
    { id: 'month' as const, label: 'Month' },
    { id: 'dates' as const, label: 'Dates' },
  ];

  protected readonly monthFilterChipLabel = computed(() => {
    const { year, month0 } = this.journalMonth();
    return new Date(year, month0, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  });

  protected readonly journalMonthLabel = computed(() => {
    const { year, month0 } = this.journalMonth();
    return new Date(year, month0, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  });

  /** The list currently shown below the chart — source depends on the active filter. */
  protected readonly sessionList = computed((): WorkoutSessionListMock[] => {
    const f = this.activeFilter();
    if (f === 'week') {
      return this.journal.weekSessions().map((r) => this.journal.sessionToListItem(r));
    }
    if (f === 'month' || f === 'dates') {
      return this.rangeSessions().map((r) => this.journal.sessionToListItem(r));
    }
    return this.journalPageItems().map((r) => this.journal.sessionToListItem(r));
  });

  /** True while the active filter's list data is (re)loading — gates the list skeleton. */
  protected readonly listLoading = computed(() => {
    const f = this.activeFilter();
    if (f === 'week') return !this.journal.weekSessionsLoaded();
    if (f === 'month' || f === 'dates') return this.rangeLoading();
    return this.journalPageLoading() && this.journalPageItems().length === 0;
  });

  protected readonly listError = computed(() => {
    const f = this.activeFilter();
    if (f === 'week') return this.journal.weekSessionsLoadState() === 'error' ? this.journal.lastError() : null;
    if (f === 'month' || f === 'dates') return this.rangeError();
    return this.journalPageError();
  });

  protected readonly datesFilterChipLabel = computed(() => {
    if (this.dateFilterSubMode() === 'single') {
      return WorkoutPage.formatDayChip(this.singleDateKey());
    }
    let a = this.rangeFromKey();
    let b = this.rangeToKey();
    if (a > b) {
      [a, b] = [b, a];
    }
    return `${WorkoutPage.formatDayChip(a)}–${WorkoutPage.formatDayChip(b)}`;
  });

  protected readonly weeklyVolumeTotal = computed(() =>
    Math.round(this.journal.weeklyVolume().values.reduce((a, b) => a + b, 0)).toLocaleString(),
  );

  /** Tapped day bar — null means "show the weekly total", set means "show that day's volume". */
  protected readonly selectedDayIdx = signal<number | null>(null);

  /** Card header: weekly total by default, or the tapped day's volume once a bar is selected. */
  protected readonly weeklyVolumeStat = computed(() => {
    const w = this.journal.weeklyVolume();
    const sel = this.selectedDayIdx();
    if (sel == null) {
      return {
        caption: 'Weekly volume',
        value: Math.round(w.values.reduce((a, b) => a + b, 0)).toLocaleString(),
        unit: 'KG',
      };
    }
    const dateKey = getCurrentWeekDayKeys()[sel];
    return {
      caption: dateKey ? formatSessionDateLabel(dateKey) : (w.dayLabels[sel] ?? '?'),
      value: Math.round(w.values[sel] ?? 0).toLocaleString(),
      unit: 'KG',
    };
  });

  /** Tap a bar to inspect that day; tap the same bar again to go back to the weekly total. */
  protected toggleDay(i: number): void {
    this.selectedDayIdx.update((cur) => (cur === i ? null : i));
  }

  /** Week-over-week % change in strength tonnage. Null if no prior-week volume to compare against, or not yet fetched. */
  protected readonly weeklyVolumeChangePct = computed(() => {
    const thisWeekTotal = this.journal.weeklyVolume().values.reduce((a, b) => a + b, 0);
    const prevWeekTotal = this.prevWeekVolumeKg();
    if (prevWeekTotal == null || prevWeekTotal <= 0) return null;
    return Math.round(((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100);
  });

  protected readonly skeletonBarHeights = [18, 34, 24, 44, 30, 40, 20];

  protected readonly weeklyBars = computed(() => {
    const w = this.journal.weeklyVolume();
    const keys = getCurrentWeekDayKeys();
    const todayKey = parseLocalDateKey(new Date());
    const max = Math.max(...w.values, 1);
    const sel = this.selectedDayIdx();
    return w.values.map((v, i) => ({
      heightPx: v <= 0 ? 4 : 8 + Math.round((v / max) * 44),
      label: w.dayLabels[i] ?? '?',
      isToday: keys[i] === todayKey,
      isSelected: i === sel,
    }));
  });

  ionViewWillEnter(): void {
    // The weekly volume chart is always current-week data, independent of the list filter below it.
    void this.journal.refreshCurrentWeekSessions();
    void this.loadPrevWeekVolume();
    void this.loadListForActiveFilter();
    this.planService.getActivePlan().catch((err) => console.error('[WorkoutPage] load active plan', err));
    this.coach.getLatest().catch((err) => console.error('[WorkoutPage] load latest nudge', err));
  }

  /** Ack the plan-nudge card — dismisses it without discarding the underlying row. */
  protected onAckNudge(id: string): void {
    void this.coach.acknowledgeNudge(id);
  }

  /** Refresh CTA on a drifted plan — hands off to the plan page, which regenerates with source 'nudge_refresh'. */
  protected onRefresh(): void {
    void this.router.navigate(['/tabs/workout/plan'], { queryParams: { refresh: 'nudge' } });
  }

  private static formatDayChip(iso: string): string {
    const d = parseIsoDateLocal(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /** Open month sheet: sync browse year to current filter month. */
  protected openMonthPicker(): void {
    this.monthPickYear.set(this.journalMonth().year);
    this.monthPickerOpen.set(true);
  }

  protected shiftMonthPickYear(delta: number): void {
    this.monthPickYear.update((y) => y + delta);
  }

  protected pickGridMonth(month0: number): void {
    this.journalMonth.set({ year: this.monthPickYear(), month0 });
    this.monthPickerOpen.set(false);
    void this.loadListForActiveFilter();
  }

  protected isJournalMonthCell(year: number, month0: number): boolean {
    const j = this.journalMonth();
    return j.year === year && j.month0 === month0;
  }

  protected openDateFilterModal(): void {
    this.dateFilterOpen.set(true);
  }

  protected setDateFilterMode(mode: 'single' | 'range'): void {
    this.dateFilterSubMode.set(mode);
  }

  protected onSingleDateInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (v?.match(/^\d{4}-\d{2}-\d{2}$/)) {
      this.singleDateKey.set(v);
    }
  }

  protected onRangeFromInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (v?.match(/^\d{4}-\d{2}-\d{2}$/)) {
      this.rangeFromKey.set(v);
    }
  }

  protected onRangeToInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (v?.match(/^\d{4}-\d{2}-\d{2}$/)) {
      this.rangeToKey.set(v);
    }
  }

  protected applyDateFilterAndClose(): void {
    this.dateFilterOpen.set(false);
    void this.loadListForActiveFilter();
  }

  protected onFilterClick(id: 'all' | 'week' | 'prs' | 'month' | 'dates'): void {
    if (id === 'month') {
      if (this.activeFilter() === 'month') {
        this.openMonthPicker();
      } else {
        this.activeFilter.set('month');
        void this.loadListForActiveFilter();
      }
      return;
    }
    if (id === 'dates') {
      if (this.activeFilter() === 'dates') {
        this.openDateFilterModal();
      } else {
        this.activeFilter.set('dates');
        void this.loadListForActiveFilter();
        this.openDateFilterModal();
      }
      return;
    }
    this.activeFilter.set(id);
    void this.loadListForActiveFilter();
  }

  protected openDetail(sessionId: string): void {
    void this.router.navigate(['/tabs/workout', sessionId]);
  }

  /** Fetch whatever the currently active filter's list needs — `week` is covered by the always-on chart fetch. */
  private async loadListForActiveFilter(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    const f = this.activeFilter();

    if (f === 'week') return;

    if (f === 'month') {
      const { year, month0 } = this.journalMonth();
      const from = parseLocalDateKey(new Date(year, month0, 1));
      const to = parseLocalDateKey(new Date(year, month0 + 1, 0));
      await this.loadRange(uid, from, to);
      return;
    }

    if (f === 'dates') {
      if (this.dateFilterSubMode() === 'single') {
        const k = this.singleDateKey();
        await this.loadRange(uid, k, k);
      } else {
        let a = this.rangeFromKey();
        let b = this.rangeToKey();
        if (a > b) [a, b] = [b, a];
        await this.loadRange(uid, a, b);
      }
      return;
    }

    await this.loadFirstPage(uid, f === 'prs');
  }

  private async loadRange(uid: string, from: string, to: string): Promise<void> {
    this.rangeLoading.set(true);
    this.rangeError.set(null);
    try {
      this.rangeSessions.set(await this.journal.listSessionsInRange(uid, from, to));
    } catch (err) {
      console.error('[WorkoutPage] range fetch', err);
      this.rangeError.set(err instanceof Error ? err.message : 'Could not load sessions');
      this.rangeSessions.set([]);
    } finally {
      this.rangeLoading.set(false);
    }
  }

  private async loadPrevWeekVolume(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    const thisMonday = parseIsoDateLocal(getCurrentWeekDayKeys()[0] ?? parseLocalDateKey(new Date()));
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(thisMonday.getDate() - 7);
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    try {
      const rows = await this.journal.listSessionsInRange(
        uid,
        parseLocalDateKey(prevMonday),
        parseLocalDateKey(prevSunday),
      );
      this.prevWeekVolumeKg.set(rows.reduce((sum, r) => sum + sessionTotalVolumeKg(r.exercises_logged ?? []), 0));
    } catch (err) {
      console.error('[WorkoutPage] prev week volume', err);
      this.prevWeekVolumeKg.set(null);
    }
  }

  private async loadFirstPage(uid: string, prOnly: boolean): Promise<void> {
    this.journalPageItems.set([]);
    this.journalHasMore.set(true);
    this.journalPageLoading.set(true);
    this.journalPageError.set(null);
    try {
      const { items, hasMore } = await this.journal.listSessionsPage(uid, { prOnly, offset: 0 });
      this.journalPageItems.set(items);
      this.journalHasMore.set(hasMore);
    } catch (err) {
      console.error('[WorkoutPage] page fetch', err);
      this.journalPageError.set(err instanceof Error ? err.message : 'Could not load sessions');
    } finally {
      this.journalPageLoading.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid || this.journalPageLoading() || !this.journalHasMore()) return;
    this.journalPageLoading.set(true);
    try {
      const { items, hasMore } = await this.journal.listSessionsPage(uid, {
        prOnly: this.activeFilter() === 'prs',
        offset: this.journalPageItems().length,
      });
      this.journalPageItems.update((cur) => [...cur, ...items]);
      this.journalHasMore.set(hasMore);
    } catch (err) {
      console.error('[WorkoutPage] load more', err);
      this.journalPageError.set(err instanceof Error ? err.message : 'Could not load more sessions');
    } finally {
      this.journalPageLoading.set(false);
    }
  }
}
