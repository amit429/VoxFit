import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  NavController,
} from '@ionic/angular/standalone';
import { DUMMY_VOICE_RESULT } from '@/app/data';
import { VoiceSessionService } from '@/app/services/voice-session.service';

type VoiceUiState = 'idle' | 'recording' | 'processing' | 'done';

@Component({
  selector: 'app-voice-log',
  standalone: true,
  templateUrl: './voice-log.page.html',
  styleUrls: ['./voice-log.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent],
})
export class VoiceLogPage {
  private readonly navCtrl = inject(NavController);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly voiceSession = inject(VoiceSessionService);

  protected readonly state = signal<VoiceUiState>('idle');
  protected readonly dots = signal('');
  protected readonly result = DUMMY_VOICE_RESULT;

  protected readonly waveHeights = [8, 14, 22, 18, 30, 24, 16, 28, 20, 12, 26, 18, 10, 22, 16];

  private holdActive = false;
  private dotsInterval?: ReturnType<typeof setInterval>;
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanupTimers();
      void this.voiceSession.cancel();
    });
  }

  protected async onHoldStart(ev: Event): Promise<void> {
    ev.preventDefault();
    if (this.state() !== 'idle') return;
    this.holdActive = true;
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
    this.stopRecording();
  }

  protected onHoldCancel(): void {
    if (this.holdActive && this.state() === 'recording') {
      this.holdActive = false;
      this.stopRecording();
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
    }
    console.log('[VoiceLog] Final transcript:', finalTranscript);
    const t = setTimeout(() => this.state.set('done'), 1600);
    this.pendingTimeouts.push(t);
  }

  protected async reRecord(): Promise<void> {
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
      this.state.set('done');
    }
  }

  protected save(): void {
    void this.navCtrl.navigateRoot('/tabs/workout', { animated: true, animationDirection: 'forward' });
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
