import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { Component, DestroyRef, inject, signal, type OnDestroy } from '@angular/core';
import type { ViewWillEnter, ViewWillLeave } from '@ionic/angular/standalone';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonModal,
  IonButton,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mic, sparklesOutline, checkmarkCircle, timeOutline } from 'ionicons/icons';
import type { DietMealSuggestion } from '@/app/models/diet-meals.models';
import { VoiceSessionService } from '@/app/services/voice-session.service';
import { GeminiDietMealsService } from '@/app/services/gemini-diet-meals.service';
import { NutritionDashboardService } from '@/app/services/nutrition-dashboard.service';
import { DietLogService } from '@/app/services/diet-log.service';
import { AuthService } from '@/app/services/auth.service';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

addIcons({ mic, sparklesOutline, checkmarkCircle, timeOutline });

type DietVoiceUiState = 'idle' | 'recording' | 'processing' | 'results';

@Component({
  selector: 'app-diet-voice-log',
  standalone: true,
  templateUrl: './diet-voice-log.page.html',
  styleUrls: ['./diet-voice-log.page.scss'],
  imports: [
    VoxPageHeaderComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonModal,
    IonButton,
    VoxCardComponent,
    VoxBadgeComponent,
    VoxIconComponent,
  ],
})
export class DietVoiceLogPage implements ViewWillEnter, ViewWillLeave, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly voiceSession = inject(VoiceSessionService);
  private readonly geminiMeals = inject(GeminiDietMealsService);
  private readonly nutrition = inject(NutritionDashboardService);
  private readonly dietLog = inject(DietLogService);
  private readonly auth = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);

  protected readonly dietFlow = signal<DietVoiceUiState>('idle');
  protected readonly dots = signal('');
  protected readonly meals = signal<DietMealSuggestion[]>([]);
  protected readonly recipeDetail = signal<DietMealSuggestion | null>(null);

  private pendingTranscript = '';

  protected readonly waveHeights = [8, 14, 22, 18, 30, 24, 16, 28, 20, 12, 26, 18, 10, 22, 16];
  private dotsInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearDotsInterval();
      void this.voiceSession.cancel();
    });
  }

  ngOnDestroy(): void {
    this.clearDotsInterval();
    void this.voiceSession.cancel();
  }

  ionViewWillEnter(): void {
    /* Fresh session each visit from Diet tab. */
    this.resetSession();
  }

  ionViewWillLeave(): void {
    this.resetSession();
  }

  protected async startListening(): Promise<void> {
    if (this.dietFlow() !== 'idle') return;
    this.meals.set([]);
    this.pendingTranscript = '';
    this.dietFlow.set('recording');
    let n = 0;
    this.clearDotsInterval();
    this.dotsInterval = setInterval(() => {
      n += 1;
      this.dots.set('.'.repeat(n % 4));
    }, 400);
    try {
      await this.voiceSession.start();
    } catch (err) {
      console.error('[DietVoiceLog] start listening', err);
      this.clearDotsInterval();
      this.dietFlow.set('idle');
      await this.presentToast(err instanceof Error ? err.message : 'Could not start microphone', 'danger');
    }
  }

  protected async stopListeningAndPlan(): Promise<void> {
    if (this.dietFlow() !== 'recording') return;
    this.clearDotsInterval();
    this.dietFlow.set('processing');
    let transcript = '';
    try {
      transcript = await this.voiceSession.stop();
    } catch (err) {
      console.error('[DietVoiceLog] stop listening', err);
      transcript = this.voiceSession.transcriptPreview().trim();
    }
    this.pendingTranscript = transcript.trim();

    if (!this.pendingTranscript) {
      await this.presentToast('No speech detected — try again.', 'warning');
      this.dietFlow.set('idle');
      return;
    }

    try {
      const p = this.auth.profile();
      const suggested = await this.geminiMeals.suggestFromTranscript(this.pendingTranscript, {
        goal: p?.goal ?? undefined,
        targetCalories: p?.target_calories ?? undefined,
        targetProteinG: p?.target_protein_g ?? undefined,
      });
      this.meals.set(suggested);
      this.dietFlow.set('results');
    } catch (err) {
      console.error('[DietVoiceLog] meal suggestion failed', err);
      const msg = err instanceof Error ? err.message : 'Could not plan meals';
      await this.presentToast(msg, 'danger');
      this.dietFlow.set('idle');
    }
  }

  protected openRecipe(meal: DietMealSuggestion): void {
    this.recipeDetail.set(meal);
  }

  protected dismissRecipe(): void {
    this.recipeDetail.set(null);
  }

  /**
   * After a successful log: remove every other suggestion and return to the start screen
   * so the user isn’t tempted to log duplicates from the same batch.
   */
  protected async logMeal(meal: DietMealSuggestion): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) {
      await this.presentToast('Sign in to log meals.', 'warning');
      return;
    }
    try {
      await this.dietLog.logSuggestedMeal(uid, meal, this.pendingTranscript);
      await this.nutrition.refresh();
      await this.presentToast('Meal logged — check the Diet tab for today’s list.', 'success');
      this.clearAfterLog();
    } catch (err) {
      console.error('[DietVoiceLog] log meal', err);
      const msg = err instanceof Error ? err.message : 'Could not save meal';
      await this.presentToast(msg, 'danger');
    }
  }

  private clearAfterLog(): void {
    void this.voiceSession.cancel();
    this.meals.set([]);
    this.pendingTranscript = '';
    this.recipeDetail.set(null);
    this.dietFlow.set('idle');
    this.dots.set('');
  }

  private resetSession(): void {
    this.clearDotsInterval();
    void this.voiceSession.cancel();
    this.meals.set([]);
    this.pendingTranscript = '';
    this.recipeDetail.set(null);
    this.dietFlow.set('idle');
    this.dots.set('');
  }

  private async presentToast(message: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2800, color, position: 'bottom' });
    await t.present();
  }

  private clearDotsInterval(): void {
    if (this.dotsInterval) {
      clearInterval(this.dotsInterval);
      this.dotsInterval = undefined;
    }
  }
}
