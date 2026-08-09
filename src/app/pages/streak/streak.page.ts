import { Component, computed, inject, signal } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, shareSocialOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import { AuthService } from '@/app/services/auth.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { StreakMilestoneService } from '@/app/services/streak-milestone.service';
import { collectSessionDateSet, computeLongestStreakDays } from '@/app/utils/workout-display.util';
import { renderStreakShareImage } from '@/app/utils/streak-share-image.util';

addIcons({ closeOutline, checkmarkOutline, shareSocialOutline });

/**
 * The streak moment — reached by tapping the streak pill on Home.
 *
 * A full page rather than a modal: it is a destination the user chooses, it
 * deep-links, and it keeps a single implementation of this visual instead of
 * one for the automatic milestone and another for the tap-through.
 *
 * Everything here derives from the bounded activity window the journal
 * service already loads (`activityRows`), so the page adds no new fetch
 * beyond refreshing that window on entry.
 */
@Component({
  selector: 'app-streak',
  standalone: true,
  templateUrl: './streak.page.html',
  styleUrls: ['./streak.page.scss'],
  imports: [IonContent, IonSpinner, VoxIconComponent, VoxCardComponent, VoxSkeletonComponent],
})
export class StreakPage implements ViewWillEnter {
  private readonly journal = inject(WorkoutJournalService);
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  private readonly milestones = inject(StreakMilestoneService);
  private readonly toastCtrl = inject(ToastController);

  /**
   * Nothing here renders until the activity window has loaded. Every figure on
   * this page derives from it, and the unloaded state reads "0 — No streak
   * going", which is an assertion rather than a placeholder.
   */
  protected readonly loaded = computed(() => this.journal.activityLoaded());

  protected readonly days = computed(() => this.journal.streak().days);
  protected readonly weekDots = computed(() => this.journal.streak().weekDots);

  protected readonly longestStreak = computed(() =>
    computeLongestStreakDays(collectSessionDateSet(this.journal.activityRows())),
  );

  /** Total days logged in the loaded window — context for a young streak. */
  protected readonly totalLoggedDays = computed(
    () => collectSessionDateSet(this.journal.activityRows()).size,
  );

  protected readonly isPersonalBest = computed(
    () => this.days() > 0 && this.days() >= this.longestStreak(),
  );

  protected readonly headline = computed(() => {
    const d = this.days();
    if (d === 0) return 'No streak going';
    if (d >= 100) return `${d} days unbroken.`;
    if (d >= 30) return 'A full month. Locked in 💪';
    if (d >= 14) return "Two weeks straight.\nYou're built different 💪";
    if (d >= 7) return 'A full week. Keep it rolling 💪';
    if (d >= 3) return "Three days in. It's a habit now.";
    return 'Day one. The hardest one.';
  });

  protected readonly subline = computed(() => {
    const d = this.days();
    if (d === 0) return 'Log a session today to start one.';

    const best = this.longestStreak();
    if (this.isPersonalBest() && best > 1) return "That's your longest run yet.";
    const gap = best - d;
    if (gap > 0) return `${gap} more day${gap === 1 ? '' : 's'} to beat your best of ${best}.`;
    return 'Keep going.';
  });

  /** Nothing to boast about at zero — the CTA would read as a taunt. */
  protected readonly canShare = computed(() => this.days() > 0);

  /** Rendering the poster takes a beat; the CTA says so rather than stalling. */
  protected readonly sharing = signal(false);

  ionViewWillEnter(): void {
    void this.auth.refreshProfile();
    void this.journal.refreshActivitySummary().then(() => this.markMilestoneSeen());
  }

  protected close(): void {
    this.navCtrl.navigateBack('/tabs/home');
  }

  /**
   * Renders the streak as a PNG poster and hands it to the OS share sheet.
   *
   * Image rather than text: a line of text is not worth sharing, and it is the
   * poster that carries the app. Web Share API Level 2 (files) is what the
   * Capacitor WebView and mobile browsers expose, so this needs no plugin —
   * but `canShare` is the only reliable way to know whether *files* are
   * accepted, since a WebView can support `share()` and reject file payloads.
   * Where files aren't accepted (desktop browsers, older WebViews) the poster
   * is saved instead, so the user still ends up with the image.
   */
  protected async share(): Promise<void> {
    if (this.sharing()) return;
    this.sharing.set(true);
    try {
      const blob = await renderStreakShareImage({
        days: this.days(),
        headline: this.headline(),
        subline: this.subline(),
        bestRun: this.longestStreak(),
        daysLogged: this.totalLoggedDays(),
        weekDots: this.weekDots(),
      });
      const file = new File([blob], 'voxfit-streak.png', { type: 'image/png' });

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My VoxFit streak',
          text: `${this.days()}-day streak on VoxFit 🔥`,
        });
        return;
      }
      this.saveFallback(blob);
      await this.presentToast('Streak image saved');
    } catch (err) {
      /* AbortError is the user dismissing the sheet — not a failure. */
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[StreakPage] share', err);
      await this.presentToast('Could not make the image right now');
    } finally {
      this.sharing.set(false);
    }
  }

  /** Saves the poster to the device instead of opening a share sheet. */
  private saveFallback(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voxfit-streak-${this.days()}-days.png`;
    a.click();
    /* Revoking synchronously can cancel the download in some engines. */
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  private markMilestoneSeen(): void {
    const pending = this.milestones.pendingMilestone(this.days());
    if (pending !== null) this.milestones.markCelebrated(pending);
  }

  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 1800, position: 'bottom' });
    await toast.present();
  }
}
