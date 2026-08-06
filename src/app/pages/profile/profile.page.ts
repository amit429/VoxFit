import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonRouterLinkWithHref, NavController } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  flagOutline,
  flameOutline,
  nutritionOutline,
  leafOutline,
  waterOutline,
  barbellOutline,
  settingsOutline,
  statsChartOutline,
  chevronForwardOutline,
  closeOutline,
  sparklesOutline,
  trendingUpOutline,
  chatbubbleEllipsesOutline,
} from 'ionicons/icons';
import { DUMMY_PROFILE_DISPLAY } from '@/app/data/profile.mock';
import type { GoalType, VoxEarnedBadge } from '@/app/models';
import { AuthService } from '@/app/services/auth.service';
import { ProgressCoachService } from '@/app/services/progress-coach.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { BadgeService } from '@/app/services/badge.service';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxBadgeShelfComponent } from '@/app/components/vox-badge-shelf/vox-badge-shelf.component';
import { VoxProgressNudgeComponent } from '@/app/components/vox-progress-nudge/vox-progress-nudge.component';
import { VoxCheckinModalComponent } from '@/app/components/vox-checkin-modal/vox-checkin-modal.component';
import { getCurrentWeekDayKeys } from '@/app/utils/workout-display.util';

addIcons({
  flagOutline,
  flameOutline,
  nutritionOutline,
  leafOutline,
  waterOutline,
  barbellOutline,
  settingsOutline,
  statsChartOutline,
  chevronForwardOutline,
  closeOutline,
  sparklesOutline,
  trendingUpOutline,
  chatbubbleEllipsesOutline,
});

/**
 * Identity, badges and preferences.
 *
 * Charts and derived stats moved to `/progress`, and the AI check-in opens in
 * a dialog rather than inline — between them they had turned this page into a
 * dozen stacked cards with no clear subject.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [
    IonContent,
    RouterLink,
    IonRouterLinkWithHref,
    VoxIconComponent,
    VoxSkeletonComponent,
    VoxCardComponent,
    VoxBadgeComponent,
    VoxBadgeShelfComponent,
    VoxProgressNudgeComponent,
    VoxCheckinModalComponent,
  ],
})
export class ProfilePage implements ViewWillEnter {
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  protected readonly journal = inject(WorkoutJournalService);
  protected readonly coach = inject(ProgressCoachService);
  private readonly badgeService = inject(BadgeService);

  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly checkinOpen = signal(false);

  protected readonly profile = this.auth.profile;

  protected readonly showSkeleton = computed(() => !this.journal.activityLoaded());

  /** All-time exact counts — count-only queries, no row data transferred. */
  protected readonly allTimeCounts = signal({ workouts: 0, prs: 0 });

  protected readonly hasReview = computed(() => this.coach.latestReview() !== null);

  protected readonly checkinTitle = computed(() =>
    this.hasReview() ? 'Your check-in is ready' : 'Get your progress check-in',
  );

  protected readonly checkinDetail = computed(() =>
    this.hasReview() ?
      'A read on how your training and nutrition are trending'
    : 'Takes a moment — we read your recent sessions and meals',
  );

  // ---- Badges ----
  //
  // Derived from live counts; there is no `user_badges` table, so a badge has
  // no earned-at date and can un-earn if a streak lapses. See Deferred #3.

  protected readonly badges = computed((): VoxEarnedBadge[] => {
    const counts = this.allTimeCounts();
    return this.badgeService.evaluate({
      streakDays: this.journal.streak().days,
      workouts: counts.workouts,
      prs: counts.prs,
    });
  });

  protected readonly goalRows = computed(() => {
    const p = this.profile();
    const weekKeys = new Set(getCurrentWeekDayKeys());
    const sessionsThisWeek = this.journal.activityRows().filter((s) => s.date && weekKeys.has(s.date)).length;

    const cals =
      p?.target_calories != null && p.target_calories > 0
        ? `${Math.round(p.target_calories).toLocaleString()} kcal`
        : 'Set targets in onboarding';
    const prot =
      p?.target_protein_g != null && p.target_protein_g > 0 ? `${Math.round(p.target_protein_g)} g` : '—';
    const carbs =
      p?.target_carbs_g != null && p.target_carbs_g > 0 ? `${Math.round(p.target_carbs_g)} g` : '—';
    const fat = p?.target_fat_g != null && p.target_fat_g > 0 ? `${Math.round(p.target_fat_g)} g` : '—';

    return [
      { icon: 'flame-outline', label: 'Daily Calories', value: cals },
      { icon: 'nutrition-outline', label: 'Protein Target', value: prot },
      { icon: 'leaf-outline', label: 'Carbs Target', value: carbs },
      { icon: 'water-outline', label: 'Fat Target', value: fat },
      { icon: 'barbell-outline', label: 'Workouts (this week)', value: `${sessionsThisWeek} logged` },
      { icon: 'flag-outline', label: 'Primary Goal', value: ProfilePage.formatGoalLabel(p?.goal ?? null) },
    ];
  });

  private static formatGoalLabel(goal: GoalType | null): string {
    if (!goal) return '—';
    if (goal === 'bulk') return 'Build muscle';
    if (goal === 'cut') return 'Fat loss';
    return 'Maintain';
  }

  protected readonly displayName = computed(
    () => this.profile()?.display_name?.trim() || DUMMY_PROFILE_DISPLAY.name,
  );

  protected readonly email = computed(
    () => this.profile()?.email?.trim() || this.auth.user()?.email || DUMMY_PROFILE_DISPLAY.email,
  );

  protected readonly avatarInitial = computed(
    () => this.displayName().trim().charAt(0).toUpperCase() || DUMMY_PROFILE_DISPLAY.initial,
  );

  protected readonly sportChip = computed(() => {
    const s = this.profile()?.sport_type;
    if (!s) return DUMMY_PROFILE_DISPLAY.sportChip;
    if (s === 'gym') return 'Gym';
    if (s === 'runner') return 'Running';
    if (s === 'cyclist') return 'Cycling';
    return 'Athletics';
  });

  protected readonly goalChip = computed(() => {
    const g = this.profile()?.goal;
    if (!g) return DUMMY_PROFILE_DISPLAY.goalChip;
    return ProfilePage.formatGoalLabel(g);
  });

  ionViewWillEnter(): void {
    void this.auth.refreshProfile();
    void this.journal.refreshActivitySummary();
    void this.loadAllTimeCounts();
    void this.coach.getLatest();
  }

  /**
   * Open the check-in, generating it first if there isn't one yet.
   *
   * The CTA carries the loading state rather than opening an empty dialog and
   * spinning inside it — the wait is for the model, not for the UI, and a
   * modal that appears then fills in reads as broken. The dialog only opens
   * once there is something to read.
   */
  protected async openCheckin(): Promise<void> {
    if (this.generating()) return;

    if (this.coach.latestReview()) {
      this.checkinOpen.set(true);
      return;
    }

    this.error.set(null);
    this.generating.set(true);
    try {
      await this.coach.generate();
      if (this.coach.latestReview()) this.checkinOpen.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Check-in failed');
    } finally {
      this.generating.set(false);
    }
  }

  protected onAcknowledge(id: string): void {
    void this.coach.acknowledgeReview(id);
  }

  private async loadAllTimeCounts(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) {
      this.allTimeCounts.set({ workouts: 0, prs: 0 });
      return;
    }
    try {
      this.allTimeCounts.set(await this.journal.getAllTimeCounts(uid));
    } catch (err) {
      console.error('[ProfilePage] all-time counts', err);
    }
  }

  protected goToSettings(): void {
    this.navCtrl.navigateForward('/settings');
  }
}
