import { SessionExerciseReviewCardComponent } from '@/app/components/session-exercise-review-card/session-exercise-review-card.component';
import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { warningOutline } from 'ionicons/icons';
import type { WorkoutDetailMock } from '@/app/data/types';
import type { WorkoutExerciseExtract } from '@/app/models/workout-extract.models';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { WorkoutSessionLogService } from '@/app/services/workout-session-log.service';
import { exerciseLoggedLikesToExtracts } from '@/app/utils/exercise-logged.mapper';

addIcons({ warningOutline });

/** Deep-linkable detail route (`/tabs/workout/:sessionId`) — real back-stack entry, not a view toggle. */
@Component({
  selector: 'app-workout-detail',
  standalone: true,
  templateUrl: './workout-detail.page.html',
  styleUrls: ['./workout-detail.page.scss'],
  imports: [VoxPageHeaderComponent, VoxCardComponent, VoxIconComponent, IonContent, SessionExerciseReviewCardComponent],
})
export class WorkoutDetailPage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly journal = inject(WorkoutJournalService);
  private readonly workoutLog = inject(WorkoutSessionLogService);
  private readonly toastCtrl = inject(ToastController);

  protected readonly detail = signal<WorkoutDetailMock | null>(null);
  protected readonly detailSessionId = signal<string | null>(null);
  protected readonly detailExercises = signal<WorkoutExerciseExtract[]>([]);
  protected readonly notFound = signal(false);

  async ionViewWillEnter(): Promise<void> {
    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    if (!sessionId) {
      this.notFound.set(true);
      return;
    }
    this.notFound.set(false);
    this.detailSessionId.set(sessionId);

    if (this.journal.sessions().length === 0) {
      await this.journal.refresh();
    }
    this.loadSession(sessionId);
  }

  private loadSession(sessionId: string): void {
    const row = this.journal.sessions().find((s) => s.id === sessionId);
    if (!row) {
      this.notFound.set(true);
      return;
    }
    this.detailExercises.set(exerciseLoggedLikesToExtracts(row.exercises_logged ?? []));
    this.detail.set(this.journal.sessionToDetail(row));
  }

  protected async onJournalExercisesChange(next: WorkoutExerciseExtract[]): Promise<void> {
    const sid = this.detailSessionId();
    if (!sid) return;
    try {
      await this.workoutLog.replaceSessionExercises(sid, next);
      await this.journal.refresh();
      this.loadSession(sid);
    } catch (err) {
      console.error('[WorkoutDetailPage] Exercise update failed:', err);
      const t = await this.toastCtrl.create({
        message: err instanceof Error ? err.message : 'Could not update exercises',
        duration: 3200,
        color: 'danger',
        position: 'bottom',
      });
      await t.present();
    }
  }

  protected goToJournal(): void {
    void this.router.navigate(['/tabs/workout']);
  }
}
