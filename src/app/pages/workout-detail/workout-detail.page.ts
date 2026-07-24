import { SessionExerciseReviewCardComponent } from '@/app/components/session-exercise-review-card/session-exercise-review-card.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { warningOutline } from 'ionicons/icons';
import type { WorkoutDetailMock, WorkoutExerciseExtract } from '@/app/models';
import { AuthService } from '@/app/services/auth.service';
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
  imports: [VoxIconComponent, VoxSkeletonComponent, IonContent, SessionExerciseReviewCardComponent],
})
export class WorkoutDetailPage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly journal = inject(WorkoutJournalService);
  private readonly workoutLog = inject(WorkoutSessionLogService);
  private readonly auth = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);

  protected readonly detail = signal<WorkoutDetailMock | null>(null);
  protected readonly detailSessionId = signal<string | null>(null);
  protected readonly detailExercises = signal<WorkoutExerciseExtract[]>([]);
  protected readonly notFound = signal(false);
  protected readonly loadingDetail = signal(true);
  protected readonly savingExercises = signal(false);

  async ionViewWillEnter(): Promise<void> {
    this.loadingDetail.set(true);
    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    const uid = this.auth.user()?.id;
    if (!sessionId || !uid) {
      this.notFound.set(true);
      this.loadingDetail.set(false);
      return;
    }
    this.notFound.set(false);
    this.detailSessionId.set(sessionId);
    await this.loadSession(uid, sessionId);
  }

  private async loadSession(uid: string, sessionId: string): Promise<void> {
    try {
      const row = await this.journal.getSessionById(uid, sessionId);
      if (!row) {
        this.notFound.set(true);
        return;
      }
      this.detailExercises.set(exerciseLoggedLikesToExtracts(row.exercises_logged ?? []));
      this.detail.set(this.journal.sessionToDetail(row));
    } catch (err) {
      console.error('[WorkoutDetailPage] load session', err);
      this.notFound.set(true);
    } finally {
      this.loadingDetail.set(false);
    }
  }

  protected async onJournalExercisesChange(next: WorkoutExerciseExtract[]): Promise<void> {
    const sid = this.detailSessionId();
    const uid = this.auth.user()?.id;
    if (!sid || !uid || this.savingExercises()) return;
    this.savingExercises.set(true);
    try {
      await this.workoutLog.replaceSessionExercises(sid, next);
      await this.loadSession(uid, sid);
    } catch (err) {
      console.error('[WorkoutDetailPage] Exercise update failed:', err);
      const t = await this.toastCtrl.create({
        message: err instanceof Error ? err.message : 'Could not update exercises',
        duration: 3200,
        color: 'danger',
        position: 'bottom',
      });
      await t.present();
    } finally {
      this.savingExercises.set(false);
    }
  }

  protected goToJournal(): void {
    void this.router.navigate(['/tabs/workout']);
  }
}
