import { Component, computed, inject, signal } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { IonContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, shareSocialOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { AuthService } from '@/app/services/auth.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { StreakMilestoneService } from '@/app/services/streak-milestone.service';
import { collectSessionDateSet, computeLongestStreakDays } from '@/app/utils/workout-display.util';

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
  imports: [IonContent, VoxIconComponent, VoxCardComponent],
})
export class StreakPage implements ViewWillEnter {
  private readonly journal = inject(WorkoutJournalService);
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  private readonly milestones = inject(StreakMilestoneService);
  private readonly toastCtrl = inject(ToastController);

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

  private readonly shareSupported = signal(false);

  /** Nothing to boast about at zero — the CTA would read as a taunt. */
  protected readonly canShare = computed(() => this.shareSupported() && this.days() > 0);

  ionViewWillEnter(): void {
    void this.auth.refreshProfile();
    void this.journal.refreshActivitySummary().then(() => this.markMilestoneSeen());
    /* Feature-detect once per view rather than in the template. */
    this.shareSupported.set(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }

  protected close(): void {
    this.navCtrl.navigateBack('/tabs/home');
  }

  /**
   * Text-only share via the Web Share API — available in the Capacitor
   * WebView and mobile browsers, so it needs no extra plugin. The mockup's
   * shareable image is not built; see Deferred #8.
   */
  protected async share(): Promise<void> {
    const text = `${this.days()}-day streak on VoxFit 🔥`;
    try {
      await navigator.share({ title: 'My VoxFit streak', text });
    } catch (err) {
      /* AbortError is the user dismissing the sheet — not a failure. */
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[StreakPage] share', err);
      await this.copyFallback(text);
    }
  }

  private async copyFallback(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      await this.presentToast('Copied to clipboard');
    } catch {
      await this.presentToast('Could not share right now');
    }
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
