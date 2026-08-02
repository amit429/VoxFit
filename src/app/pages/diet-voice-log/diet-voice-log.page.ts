import { Component, DestroyRef, effect, inject, signal, type OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import type { ViewWillEnter, ViewWillLeave } from '@ionic/angular/standalone';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonModal,
  IonButton,
  IonSpinner,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  sparklesOutline,
  checkmarkCircle,
  checkmarkOutline,
  timeOutline,
  chevronBackOutline,
  restaurantOutline,
} from 'ionicons/icons';
import type { DietMealSuggestion, EatenMealAnalysis } from '@/app/models';
import { VoiceSessionService } from '@/app/services/voice-session.service';
import { GeminiDietMealsService } from '@/app/services/gemini-diet-meals.service';
import { NutritionDashboardService } from '@/app/services/nutrition-dashboard.service';
import { DietLogService } from '@/app/services/diet-log.service';
import { AuthService } from '@/app/services/auth.service';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { voxfitMic } from '@/app/components/vox-icon/voxfit-icons';

addIcons({
  sparklesOutline,
  checkmarkCircle,
  checkmarkOutline,
  timeOutline,
  chevronBackOutline,
  restaurantOutline,
  voxfitMic,
});

type DietVoiceUiState = 'idle' | 'recording' | 'processing' | 'results';
type DietVoiceMode = 'suggest' | 'log_eaten';

@Component({
  selector: 'app-diet-voice-log',
  standalone: true,
  templateUrl: './diet-voice-log.page.html',
  styleUrls: ['./diet-voice-log.page.scss'],
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonModal,
    IonButton,
    IonSpinner,
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
  protected readonly mode = signal<DietVoiceMode | null>(null);
  protected readonly dots = signal('');
  protected readonly meals = signal<DietMealSuggestion[]>([]);
  protected readonly eatenMeal = signal<EatenMealAnalysis | null>(null);
  protected readonly recipeDetail = signal<DietMealSuggestion | null>(null);
  /** Key of the suggested-meal card currently being logged, or null when none is in flight — blocks double-logging across the list. */
  protected readonly loggingMealKey = signal<string | null>(null);
  protected readonly loggingEaten = signal(false);

  /** Raw browser transcript — only ever needed as Gemini's suggestion input, never persisted. */
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

  protected chooseMode(m: DietVoiceMode): void {
    if (this.dietFlow() !== 'idle') return;
    this.mode.set(m);
  }

  protected backToPicker(): void {
    if (this.dietFlow() !== 'idle') return;
    this.mode.set(null);
  }

  protected async startListening(): Promise<void> {
    if (this.dietFlow() !== 'idle' || this.mode() === null) return;
    this.meals.set([]);
    this.eatenMeal.set(null);
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
      if (this.mode() === 'log_eaten') {
        const result = await this.geminiMeals.analyzeEatenMeal(this.pendingTranscript);
        this.eatenMeal.set(result.meal);
      } else {
        const p = this.auth.profile();
        const result = await this.geminiMeals.suggestFromTranscript(this.pendingTranscript, {
          goal: p?.goal ?? undefined,
          targetCalories: p?.target_calories ?? undefined,
          targetProteinG: p?.target_protein_g ?? undefined,
        });
        this.meals.set([...result.meals]);
      }
      this.dietFlow.set('results');
    } catch (err) {
      console.error('[DietVoiceLog] meal analysis failed', err);
      const msg =
        err instanceof Error ? err.message
        : this.mode() === 'log_eaten' ? 'Could not analyze meal'
        : 'Could not plan meals';
      await this.presentToast(msg, 'danger');
      this.dietFlow.set('idle');
    }
  }

  protected mealKey(meal: DietMealSuggestion, index: number): string {
    return `${meal.name}::${index}`;
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
  protected async logMeal(meal: DietMealSuggestion, index: number): Promise<void> {
    if (this.loggingMealKey() !== null) return;
    const uid = this.auth.user()?.id;
    if (!uid) {
      await this.presentToast('Sign in to log meals.', 'warning');
      return;
    }
    this.loggingMealKey.set(this.mealKey(meal, index));
    try {
      await this.dietLog.logSuggestedMeal(uid, meal);
      await this.nutrition.refresh();
      await this.presentToast('Meal logged — check the Diet tab for today’s list.', 'success');
      this.clearAfterLog();
    } catch (err) {
      console.error('[DietVoiceLog] log meal', err);
      const msg = err instanceof Error ? err.message : 'Could not save meal';
      await this.presentToast(msg, 'danger');
    } finally {
      this.loggingMealKey.set(null);
    }
  }

  /** Mirrors `logMeal` for the log-eaten flow — no recipe/prep fields, `source: 'manual'`. */
  protected async logEatenMeal(meal: EatenMealAnalysis): Promise<void> {
    if (this.loggingEaten()) return;
    const uid = this.auth.user()?.id;
    if (!uid) {
      await this.presentToast('Sign in to log meals.', 'warning');
      return;
    }
    this.loggingEaten.set(true);
    try {
      await this.dietLog.logEatenMeal(uid, meal);
      await this.nutrition.refresh();
      await this.presentToast('Meal logged — check the Diet tab for today’s list.', 'success');
      this.clearAfterLog();
    } catch (err) {
      console.error('[DietVoiceLog] log eaten meal', err);
      const msg = err instanceof Error ? err.message : 'Could not save meal';
      await this.presentToast(msg, 'danger');
    } finally {
      this.loggingEaten.set(false);
    }
  }

  private clearAfterLog(): void {
    void this.voiceSession.cancel();
    this.meals.set([]);
    this.eatenMeal.set(null);
    this.mode.set(null);
    this.pendingTranscript = '';
    this.recipeDetail.set(null);
    this.dietFlow.set('idle');
    this.dots.set('');
  }

  private resetSession(): void {
    this.clearDotsInterval();
    void this.voiceSession.cancel();
    this.meals.set([]);
    this.eatenMeal.set(null);
    this.mode.set(null);
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
