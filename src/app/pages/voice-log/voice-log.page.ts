import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { IonContent, NavController, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mic, sparklesOutline, checkmarkCircle, warningOutline } from 'ionicons/icons';
import type { VoiceDoneMock } from '@/app/data/types';
import type { WorkoutExerciseExtract, WorkoutExtractResult } from '@/app/models/workout-extract.models';
import { VoiceSessionService } from '@/app/services/voice-session.service';
import { GeminiWorkoutExtractService } from '@/app/services/gemini-workout-extract.service';
import { WorkoutSessionLogService } from '@/app/services/workout-session-log.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { AuthService } from '@/app/services/auth.service';
import { workoutExtractToVoiceDoneMock } from '@/app/utils/workout-extract-ui.mapper';
import { SessionExerciseReviewCardComponent } from '@/app/components/session-exercise-review-card/session-exercise-review-card.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

addIcons({ mic, sparklesOutline, checkmarkCircle, warningOutline });

type VoiceUiState = 'idle' | 'recording' | 'processing' | 'done';

@Component({
  selector: 'app-voice-log',
  standalone: true,
  templateUrl: './voice-log.page.html',
  styleUrls: ['./voice-log.page.scss'],
  imports: [
    VoxPageHeaderComponent,
    IonContent,
    NgClass,
    SessionExerciseReviewCardComponent,
    VoxCardComponent,
    VoxBadgeComponent,
    VoxIconComponent,
  ],
})
export class VoiceLogPage {
  private readonly navCtrl = inject(NavController);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly voiceSession = inject(VoiceSessionService);
  private readonly geminiExtract = inject(GeminiWorkoutExtractService);
  private readonly workoutLog = inject(WorkoutSessionLogService);
  private readonly workoutJournal = inject(WorkoutJournalService);
  private readonly auth = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);

  protected readonly state = signal<VoiceUiState>('idle');
  protected readonly dots = signal('');
  protected readonly result = signal<VoiceDoneMock | null>(null);
  protected readonly cardExercises = signal<WorkoutExerciseExtract[]>([]);

  private pendingTranscript = '';
  private pendingExtract: WorkoutExtractResult | null = null;

  protected readonly waveHeights = [8, 14, 22, 18, 30, 24, 16, 28, 20, 12, 26, 18, 10, 22, 16];

  /** Display-only: distinguishes the synthetic "no flags" checkmark from a real warning glyph. */
  protected flagsOk(res: VoiceDoneMock): boolean {
    return res.flagsEmoji !== '⚠️';
  }

  private holdActive = false;
  private dotsInterval?: ReturnType<typeof setInterval>;
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanupTimers();
      void this.voiceSession.cancel();
    });
  }

  protected onCardExercisesChange(next: WorkoutExerciseExtract[]): void {
    const pe = this.pendingExtract;
    if (!pe) return;
    this.pendingExtract = { ...pe, exercises: next };
    this.cardExercises.set(next);
    this.result.set(workoutExtractToVoiceDoneMock(this.pendingExtract));
  }

  protected async onHoldStart(ev: Event): Promise<void> {
    ev.preventDefault();
    if (this.state() !== 'idle') return;
    this.holdActive = true;
    this.cleanupTimers();
    this.result.set(null);
    this.cardExercises.set([]);
    this.state.set('recording');
    let n = 0;
    this.dotsInterval = setInterval(() => {
      n += 1;
      this.dots.set('.'.repeat(n % 4));
    }, 400);
    try {
      await this.voiceSession.start();
    } catch (err) {
      console.error('[VoiceLog] Failed to start listening:', err);
      this.clearDotsInterval();
      this.state.set('idle');
      this.holdActive = false;
    }
  }

  protected onHoldEnd(ev: Event): void {
    ev.preventDefault();
    if (!this.holdActive || this.state() !== 'recording') return;
    this.holdActive = false;
    void this.stopRecording();
  }

  protected onHoldCancel(): void {
    if (this.holdActive && this.state() === 'recording') {
      this.holdActive = false;
      void this.stopRecording();
    }
  }

  protected async stopRecording(): Promise<void> {
    if (this.state() !== 'recording') return;
    this.clearDotsInterval();
    this.state.set('processing');
    let finalTranscript = '';
    try {
      finalTranscript = await this.voiceSession.stop();
    } catch (err) {
      console.error('[VoiceLog] Failed to stop listening:', err);
      finalTranscript = this.voiceSession.transcriptPreview().trim();
    }
    console.log('[VoiceLog] Final transcript:', finalTranscript);
    this.pendingTranscript = finalTranscript;

    if (!finalTranscript.trim()) {
      await this.presentToast('No speech detected — try again.', 'warning');
      this.state.set('idle');
      return;
    }

    try {
      const parsed = await this.geminiExtract.extractFromTranscript(finalTranscript);
      this.pendingExtract = parsed;
      console.log('[VoiceLog] Parsed workout:', parsed);
      this.cardExercises.set([...parsed.exercises]);
      this.result.set(workoutExtractToVoiceDoneMock(parsed));
      this.state.set('done');
    } catch (err) {
      console.error('[VoiceLog] Extraction failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not parse workout';
      await this.presentToast(msg, 'danger');
      this.state.set('idle');
    }
  }

  protected async reRecord(): Promise<void> {
    this.pendingExtract = null;
    this.pendingTranscript = '';
    this.result.set(null);
    this.cardExercises.set([]);
    this.cleanupTimers();
    this.state.set('recording');
    let n = 0;
    this.dotsInterval = setInterval(() => {
      n += 1;
      this.dots.set('.'.repeat(n % 4));
    }, 400);
    try {
      await this.voiceSession.start();
    } catch (err) {
      console.error('[VoiceLog] Failed to restart listening:', err);
      this.clearDotsInterval();
      this.state.set('idle');
    }
  }

  protected async save(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) {
      await this.presentToast('Sign in to save your workout.', 'warning');
      return;
    }
    const parsedBase = this.pendingExtract;
    if (!parsedBase) {
      await this.presentToast('Nothing to save.', 'warning');
      return;
    }
    const parsed = { ...parsedBase, exercises: this.cardExercises() };
    this.pendingExtract = parsed;
    try {
      await this.workoutLog.saveSession(uid, this.pendingTranscript, parsed);
      await this.workoutJournal.refresh();
      await this.presentToast('Workout saved!', 'success');
      void this.navCtrl.navigateRoot('/tabs/workout', { animated: true, animationDirection: 'forward' });
    } catch (err) {
      console.error('[VoiceLog] Save failed:', err);
      const msg = err instanceof Error ? err.message : 'Save failed';
      await this.presentToast(msg, 'danger');
    }
  }

  private async presentToast(message: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 3200, color, position: 'bottom' });
    await t.present();
  }

  private clearDotsInterval(): void {
    if (this.dotsInterval) {
      clearInterval(this.dotsInterval);
      this.dotsInterval = undefined;
    }
  }

  private cleanupTimers(): void {
    this.clearDotsInterval();
    this.pendingTimeouts.forEach((id) => clearTimeout(id));
    this.pendingTimeouts = [];
  }
}
