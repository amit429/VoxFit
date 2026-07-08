import { SessionExerciseReviewCardComponent } from '@/app/components/session-exercise-review-card/session-exercise-review-card.component';
import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { Component, computed, inject, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonIcon,
  IonModal,
  IonButton,
  ToastController,
} from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';
import type { WorkoutDetailMock } from '@/app/data/types';
import type { WorkoutExerciseExtract } from '@/app/models/workout-extract.models';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { WorkoutSessionLogService } from '@/app/services/workout-session-log.service';
import { exerciseLoggedLikesToExtracts } from '@/app/utils/exercise-logged.mapper';
import { getCurrentWeekDayKeys, parseLocalDateKey, parseIsoDateLocal } from '@/app/utils/workout-display.util';

addIcons({ chevronBackOutline });

@Component({
  selector: 'app-workout',
  standalone: true,
  templateUrl: './workout.page.html',
  styleUrls: ['./workout.page.scss'],
  imports: [
    VoxPageHeaderComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonIcon,
    IonModal,
    IonButton,
    SessionExerciseReviewCardComponent,
  ],
})
export class WorkoutPage implements ViewWillEnter {
  protected readonly journal = inject(WorkoutJournalService);
  private readonly workoutLog = inject(WorkoutSessionLogService);
  private readonly toastCtrl = inject(ToastController);

  protected readonly view = signal<'list' | 'detail'>('list');
  protected readonly activeFilter = signal<'all' | 'week' | 'prs' | 'month' | 'dates'>('all');
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

  protected readonly detail = signal<WorkoutDetailMock | null>(null);
  protected readonly detailSessionId = signal<string | null>(null);
  protected readonly detailExercises = signal<WorkoutExerciseExtract[]>([]);

  protected readonly filters = [
    { id: 'all' as const, label: 'All' },
    { id: 'week' as const, label: 'This week' },
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

  protected readonly sessionList = computed(() => {
    const rows = this.journal.sessions();
    const items = rows.map((r) => this.journal.sessionToListItem(r));
    const f = this.activeFilter();
    if (f === 'week') {
      const week = new Set(getCurrentWeekDayKeys());
      return items.filter((i) => week.has(i.dateKey));
    }
    if (f === 'prs') {
      return items.filter((i) => i.hasPr);
    }
    if (f === 'month') {
      const { year, month0 } = this.journalMonth();
      const wantM = month0 + 1;
      return items.filter((i) => {
        if (!i.dateKey) return false;
        const p = i.dateKey.split('-').map((x) => Number(x));
        const yy = p[0];
        const mm = p[1];
        return yy === year && mm === wantM;
      });
    }
    if (f === 'dates') {
      if (this.dateFilterSubMode() === 'single') {
        const k = this.singleDateKey();
        return items.filter((i) => i.dateKey === k);
      }
      let a = this.rangeFromKey();
      let b = this.rangeToKey();
      if (a > b) {
        [a, b] = [b, a];
      }
      return items.filter((i) => !!i.dateKey && i.dateKey >= a && i.dateKey <= b);
    }
    return items;
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

  protected readonly weeklyBars = computed(() => {
    const w = this.journal.weeklyVolume();
    const keys = getCurrentWeekDayKeys();
    const todayKey = parseLocalDateKey(new Date());
    const max = Math.max(...w.values, 1);
    return w.values.map((v, i) => ({
      heightPx: v <= 0 ? 4 : 8 + Math.round((v / max) * 44),
      label: w.dayLabels[i] ?? '?',
      isToday: keys[i] === todayKey,
    }));
  });

  ionViewWillEnter(): void {
    void this.journal.refresh();
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
  }

  protected onFilterClick(id: 'all' | 'week' | 'prs' | 'month' | 'dates'): void {
    if (id === 'month') {
      if (this.activeFilter() === 'month') {
        this.openMonthPicker();
      } else {
        this.activeFilter.set('month');
      }
      return;
    }
    if (id === 'dates') {
      if (this.activeFilter() === 'dates') {
        this.openDateFilterModal();
      } else {
        this.activeFilter.set('dates');
        this.openDateFilterModal();
      }
      return;
    }
    this.activeFilter.set(id);
  }

  protected openDetail(sessionId: string): void {
    const row = this.journal.sessions().find((s) => s.id === sessionId);
    if (!row) return;
    this.detailSessionId.set(sessionId);
    this.detailExercises.set(exerciseLoggedLikesToExtracts(row.exercises_logged ?? []));
    this.detail.set(this.journal.sessionToDetail(row));
    this.view.set('detail');
  }

  protected async onJournalExercisesChange(next: WorkoutExerciseExtract[]): Promise<void> {
    const sid = this.detailSessionId();
    if (!sid) return;
    try {
      await this.workoutLog.replaceSessionExercises(sid, next);
      await this.journal.refresh();
      const row = this.journal.sessions().find((s) => s.id === sid);
      if (row) {
        this.detail.set(this.journal.sessionToDetail(row));
        this.detailExercises.set(exerciseLoggedLikesToExtracts(row.exercises_logged ?? []));
      }
    } catch (err) {
      console.error('[WorkoutPage] Exercise update failed:', err);
      const t = await this.toastCtrl.create({
        message: err instanceof Error ? err.message : 'Could not update exercises',
        duration: 3200,
        color: 'danger',
        position: 'bottom',
      });
      await t.present();
    }
  }

  protected goList(): void {
    this.view.set('list');
    this.detail.set(null);
    this.detailSessionId.set(null);
    this.detailExercises.set([]);
  }
}
