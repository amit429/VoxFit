import { Component, computed, inject, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonIcon,
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
import { getCurrentWeekDayKeys, parseLocalDateKey } from '@/app/utils/workout-display.util';
import { SessionExerciseReviewCardComponent } from '@/app/components/session-exercise-review-card/session-exercise-review-card.component';

addIcons({ chevronBackOutline });

@Component({
  selector: 'app-workout',
  standalone: true,
  templateUrl: './workout.page.html',
  styleUrls: ['./workout.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonIcon,
    SessionExerciseReviewCardComponent,
  ],
})
export class WorkoutPage implements ViewWillEnter {
  protected readonly journal = inject(WorkoutJournalService);
  private readonly workoutLog = inject(WorkoutSessionLogService);
  private readonly toastCtrl = inject(ToastController);

  protected readonly view = signal<'list' | 'detail'>('list');
  protected readonly activeFilter = signal<'all' | 'week' | 'prs'>('all');
  protected readonly detail = signal<WorkoutDetailMock | null>(null);
  protected readonly detailSessionId = signal<string | null>(null);
  protected readonly detailExercises = signal<WorkoutExerciseExtract[]>([]);

  protected readonly filters = [
    { id: 'all' as const, label: 'All' },
    { id: 'week' as const, label: 'This Week' },
    { id: 'prs' as const, label: 'PRs Only' },
  ];

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
    return items;
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
