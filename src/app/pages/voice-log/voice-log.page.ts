import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ViewDidEnter } from '@ionic/angular/standalone';
import { IonContent, IonSpinner, NavController, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  sparklesOutline,
  checkmarkCircle,
  warningOutline,
  close,
  refreshOutline,
  checkmarkOutline,
  chevronBackOutline,
  micOutline,
} from 'ionicons/icons';
import type { VoiceDoneMock, WorkoutExerciseExtract, WorkoutExtractResult } from '@/app/models';
import { VoiceSessionService } from '@/app/services/voice-session.service';
import { GeminiWorkoutExtractService } from '@/app/services/gemini-workout-extract.service';
import { WorkoutSessionLogService } from '@/app/services/workout-session-log.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { AuthService } from '@/app/services/auth.service';
import { TourService } from '@/app/services/tour.service';
import { workoutExtractToVoiceDoneMock } from '@/app/utils/workout-extract-ui.mapper';
import { SessionExerciseReviewCardComponent } from '@/app/components/session-exercise-review-card/session-exercise-review-card.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxVoiceOrbComponent } from '@/app/components/vox-voice-orb/vox-voice-orb.component';
import { VoxStatTileComponent } from '@/app/components/vox-stat-tile/vox-stat-tile.component';
import { voxfitMic } from '@/app/components/vox-icon/voxfit-icons';
import { exerciseStrengthVolumeKg } from '@/app/utils/workout-display.util';

addIcons({
  sparklesOutline,
  checkmarkCircle,
  warningOutline,
  close,
  refreshOutline,
  checkmarkOutline,
  chevronBackOutline,
  micOutline,
  voxfitMic,
});

type VoiceUiState = 'idle' | 'recording' | 'processing' | 'done';

@Component({
  selector: 'app-voice-log',
  standalone: true,
  templateUrl: './voice-log.page.html',
  styleUrls: ['./voice-log.page.scss'],
  imports: [
    RouterLink,
    IonContent,
    IonSpinner,
    SessionExerciseReviewCardComponent,
    VoxIconComponent,
    VoxCardComponent,
    VoxBadgeComponent,
    VoxVoiceOrbComponent,
    VoxStatTileComponent,
  ],
})
export class VoiceLogPage implements ViewDidEnter {
  private readonly navCtrl = inject(NavController);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly voiceSession = inject(VoiceSessionService);
  private readonly geminiExtract = inject(GeminiWorkoutExtractService);
  private readonly workoutLog = inject(WorkoutSessionLogService);
  private readonly workoutJournal = inject(WorkoutJournalService);
  private readonly auth = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly tourService = inject(TourService);

  protected readonly state = signal<VoiceUiState>('idle');
  protected readonly dots = signal('');
  protected readonly result = signal<VoiceDoneMock | null>(null);
  protected readonly cardExercises = signal<WorkoutExerciseExtract[]>([]);
  protected readonly saving = signal(false);
  /** Live recording duration for the recording-state timer. */
  protected readonly elapsedSeconds = signal(0);

  private pendingExtract: WorkoutExtractResult | null = null;

  /**
   * Total strength volume across the extracted exercises, for the hero stat
   * row. The unit lives in the tile's label, so the figure is bare here —
   * `formatVolumeKg` would append a second "kg".
   */
  protected readonly volumeLabel = computed(() => {
    const total = this.cardExercises().reduce(
      (sum, ex) =>
        sum +
        exerciseStrengthVolumeKg({
          exercise_type: ex.exercise_type,
          sets: null,
          reps: null,
          weight_kg: null,
          set_lines: ex.set_lines,
        }),
      0,
    );
    return total > 0 ? Math.round(total).toLocaleString() : '—';
  });

  protected readonly prCount = computed(() => this.cardExercises().filter((ex) => ex.is_pr).length);

  private dotsInterval?: ReturnType<typeof setInterval>;
  private timerInterval?: ReturnType<typeof setInterval>;
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  protected formatTime(s: number): string {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const r = (s % 60).toString().padStart(2, '0');
    return `${m}:${r}`;
  }

  /**
   * Label for the processing screen. The wait spans two distinct operations
   * (upload + transcribe, then Gemini structuring) and naming them is what stops
   * a three-second pause reading as a hang.
   */
  protected readonly processingLabel = computed(() => {
    switch (this.voiceSession.phase()) {
      case 'uploading':
        return 'Sending your recording';
      case 'transcribing':
        return 'Transcribing';
      default:
        return 'Parsing your session';
    }
  });

  constructor() {
    // The service halts the recorder at its own duration cap. Submit what was
    // captured rather than leaving the user talking into a stopped recorder.
    effect(() => {
      if (this.voiceSession.limitReached() && this.state() === 'recording') {
        void this.stopRecording();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.cleanupTimers();
      void this.voiceSession.cancel();
    });
  }

  ionViewDidEnter(): void {
    if (!this.tourService.takeReplay('workout')) {
      this.tourService.maybeStartWorkout();
    }
  }

  protected onCardExercisesChange(next: WorkoutExerciseExtract[]): void {
    const pe = this.pendingExtract;
    if (!pe) return;
    this.pendingExtract = { ...pe, exercises: next };
    this.cardExercises.set(next);
    this.result.set(workoutExtractToVoiceDoneMock(this.pendingExtract));
  }

  /**
   * Tap to start. Recording continues until the user taps "Structure it" or
   * "Cancel" — it is not tied to the press.
   *
   * This was press-and-hold, which the two explicit stop/cancel buttons below
   * already contradicted, and which made a normal tap start and instantly stop
   * the recorder ("No speech detected"). The diet voice screen was already
   * tap-based; the two now behave the same.
   */
  protected async startRecording(): Promise<void> {
    if (this.state() !== 'idle') return;
    this.result.set(null);
    this.cardExercises.set([]);
    await this.beginRecording();
  }

  /**
   * Shared by the first tap and "Record again" — the two were identical
   * copies, so a fix to one silently missed the other.
   */
  private async beginRecording(): Promise<void> {
    this.cleanupTimers();
    this.state.set('recording');
    let n = 0;
    this.dotsInterval = setInterval(() => {
      n += 1;
      this.dots.set('.'.repeat(n % 4));
    }, 400);
    this.elapsedSeconds.set(0);
    this.timerInterval = setInterval(() => this.elapsedSeconds.update((s) => s + 1), 1000);
    try {
      await this.voiceSession.start();
    } catch (err) {
      console.error('[VoiceLog] Failed to start recording:', err);
      // Previously this only cleared the dots and stayed silent: the elapsed
      // timer kept ticking against a recorder that never started, and the user
      // was told nothing. Permission denial is the common case here.
      this.cleanupTimers();
      this.state.set('idle');
      const msg = err instanceof Error ? err.message : 'Could not start recording.';
      await this.presentToast(msg, 'danger');
    }
  }

  /** Discard the in-progress recording without parsing it — distinct from Stop, which proceeds to extraction. */
  protected async cancelRecording(): Promise<void> {
    if (this.state() !== 'recording') return;
    this.cleanupTimers();
    try {
      await this.voiceSession.cancel();
    } catch (err) {
      console.error('[VoiceLog] Failed to cancel recording:', err);
    }
    this.state.set('idle');
  }

  protected async stopRecording(): Promise<void> {
    if (this.state() !== 'recording') return;
    this.cleanupTimers();
    this.state.set('processing');
    let finalTranscript = '';
    try {
      finalTranscript = await this.voiceSession.stop();
    } catch (err) {
      // There is no partial transcript to fall back on any more — the clip is
      // transcribed in one call, so a failure here means we have nothing.
      // Saying so beats silently showing "No speech detected".
      console.error('[VoiceLog] Transcription failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not transcribe that recording.';
      await this.presentToast(msg, 'danger');
      this.state.set('idle');
      return;
    }
    if (!finalTranscript.trim()) {
      await this.presentToast('No speech detected — try again.', 'warning');
      this.state.set('idle');
      return;
    }

    try {
      const parsed = await this.geminiExtract.extractFromTranscript(finalTranscript);
      this.pendingExtract = parsed;
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
    this.result.set(null);
    this.cardExercises.set([]);
    await this.beginRecording();
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
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
    this.saving.set(true);
    try {
      await this.workoutLog.saveSession(uid, parsed);
      await Promise.all([this.workoutJournal.refreshCurrentWeekSessions(), this.workoutJournal.refreshActivitySummary()]);
      await this.presentToast('Workout saved!', 'success');
      void this.navCtrl.navigateRoot('/tabs/workout', { animated: true, animationDirection: 'forward' });
    } catch (err) {
      console.error('[VoiceLog] Save failed:', err);
      const msg = err instanceof Error ? err.message : 'Save failed';
      await this.presentToast(msg, 'danger');
    } finally {
      this.saving.set(false);
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
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    this.pendingTimeouts.forEach((id) => clearTimeout(id));
    this.pendingTimeouts = [];
  }
}
