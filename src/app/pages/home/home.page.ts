import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { IonContent, IonRouterLinkWithHref } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  micOutline,
  restaurantOutline,
  statsChartOutline,
  listOutline,
  barbellOutline,
  chevronForwardOutline,
  sparklesOutline,
  trendingUpOutline,
  chatbubbleEllipsesOutline,
  closeOutline,
  checkmarkOutline,
} from 'ionicons/icons';
import { DUMMY_PROFILE_DISPLAY } from '@/app/data';
import { AuthService } from '@/app/services/auth.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { NutritionDashboardService } from '@/app/services/nutrition-dashboard.service';
import { ProgressCoachService } from '@/app/services/progress-coach.service';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxVoiceOrbComponent } from '@/app/components/vox-voice-orb/vox-voice-orb.component';
import { VoxStreakPillComponent } from '@/app/components/vox-streak-pill/vox-streak-pill.component';
import { VoxQuickActionGridComponent } from '@/app/components/vox-quick-action-grid/vox-quick-action-grid.component';
import { VoxProgressNudgeComponent } from '@/app/components/vox-progress-nudge/vox-progress-nudge.component';
import { voxfitMic } from '@/app/components/vox-icon/voxfit-icons';
import { sessionTotalVolumeKg, formatVolumeKg, formatSessionDateLabel } from '@/app/utils/workout-display.util';
import type { VoxQuickAction } from '@/app/models';

addIcons({
  micOutline,
  restaurantOutline,
  statsChartOutline,
  listOutline,
  barbellOutline,
  chevronForwardOutline,
  sparklesOutline,
  trendingUpOutline,
  chatbubbleEllipsesOutline,
  closeOutline,
  checkmarkOutline,
  voxfitMic,
});

/** Macro tiles under the orb. Colour is by series, matching the fuel screen. */
const MACRO_TRACK_TONES: Record<string, string> = {
  Protein: 'linear-gradient(90deg, #3fb68f, #2e8f70)',
  Carbs: 'linear-gradient(90deg, #6b92d6, #557ab8)',
  Fat: 'linear-gradient(90deg, #e8a055, #d9834a)',
};

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    IonContent,
    RouterLink,
    IonRouterLinkWithHref,
    VoxSkeletonComponent,
    VoxCardComponent,
    VoxBadgeComponent,
    VoxVoiceOrbComponent,
    VoxStreakPillComponent,
    VoxQuickActionGridComponent,
    VoxProgressNudgeComponent,
  ],
})
export class HomePage implements ViewWillEnter {
  protected readonly auth = inject(AuthService);
  protected readonly journal = inject(WorkoutJournalService);
  protected readonly nutrition = inject(NutritionDashboardService);
  protected readonly coach = inject(ProgressCoachService);

  protected readonly showSkeleton = computed(
    () => !this.journal.activityLoaded() || !this.journal.weekSessionsLoaded() || !this.nutrition.hasLoadedOnce(),
  );

  protected readonly quickActions: readonly VoxQuickAction[] = [
    { icon: 'barbell-outline', label: ['log', 'workout'], link: '/voice', tone: 'jade' },
    { icon: 'restaurant-outline', label: ['log', 'meal'], link: '/log-diet', tone: 'apricot' },
    { icon: 'list-outline', label: ['my', 'plan'], link: '/tabs/workout/plan', tone: 'brand' },
    { icon: 'stats-chart-outline', label: ['my', 'progress'], link: '/tabs/profile', tone: 'slate' },
  ];

  protected readonly macros = computed(() => this.nutrition.macros());

  protected readonly caloriesRow = computed(() => this.macros().rows.find((r) => r.label === 'Calories') ?? null);

  /** Protein / carbs / fat with a fill width, for the three-column fuel card. */
  protected readonly macroColumns = computed(() =>
    this.macros()
      .rows.filter((r) => r.label !== 'Calories')
      .map((r) => ({
        label: r.label,
        current: r.current,
        pct: r.target > 0 ? Math.min(100, Math.round((r.current / r.target) * 100)) : 0,
        track: MACRO_TRACK_TONES[r.label] ?? 'linear-gradient(90deg, #8b80f0, #6559c8)',
      })),
  );

  /**
   * Most recent session in the loaded week, today's included. The mockup's
   * "last session" strip — a glance at what you did, not a full journal row.
   */
  protected readonly lastSession = computed(() => {
    const sessions = [...this.journal.weekSessions()].sort((a, b) =>
      (b.date ?? '').localeCompare(a.date ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    );
    const latest = sessions[0];
    if (!latest) return null;

    const exercises = latest.exercises_logged ?? [];
    const prCount = exercises.filter((e) => e.is_pr).length;
    return {
      id: latest.id,
      title: latest.session_label?.trim() || 'Workout',
      dateLabel: latest.date ? formatSessionDateLabel(latest.date) : '—',
      detail: `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} · ${formatVolumeKg(sessionTotalVolumeKg(exercises))}`,
      prCount,
    };
  });

  protected readonly todayLabel = signal(
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase(),
  );

  protected readonly firstName = computed(() => {
    const n = this.auth.profile()?.display_name?.trim();
    if (n) return n.split(/\s+/)[0] ?? n;
    return DUMMY_PROFILE_DISPLAY.name.split(/\s+/)[0] ?? 'Athlete';
  });

  protected readonly greeting = computed(() => this.pickGreeting());

  protected readonly showReviewPointer = computed(() => {
    const r = this.coach.latestReview();
    return !!r && !r.acknowledged_at;
  });

  protected readonly showNudgePointer = computed(() => {
    const n = this.coach.latestNudge();
    return !!n && !n.acknowledged_at;
  });

  protected readonly initial = computed(() => {
    const n = this.auth.profile()?.display_name?.trim();
    if (n) return n.charAt(0).toUpperCase();
    return DUMMY_PROFILE_DISPLAY.initial;
  });

  ionViewWillEnter(): void {
    void this.journal.refreshActivitySummary();
    void this.journal.refreshCurrentWeekSessions();
    void this.nutrition.refresh();
    void this.auth.refreshProfile();
    void this.coach.getLatest();
  }

  private pickGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
