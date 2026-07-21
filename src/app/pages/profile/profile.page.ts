import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { Component, computed, inject } from '@angular/core';
import { NavController } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { IonContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  flagOutline,
  logOutOutline,
  flameOutline,
  nutritionOutline,
  leafOutline,
  waterOutline,
  barbellOutline,
  settingsOutline,
} from 'ionicons/icons';
import { DUMMY_PROFILE_DISPLAY } from '@/app/data/profile.mock';
import type { GoalType } from '@/app/models/user.models';
import { AuthService } from '@/app/services/auth.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { getCurrentWeekDayKeys, parseLocalDateKey } from '@/app/utils/workout-display.util';

addIcons({
  flagOutline,
  logOutOutline,
  flameOutline,
  nutritionOutline,
  leafOutline,
  waterOutline,
  barbellOutline,
  settingsOutline,
});

export interface HeatmapCellVm {
  readonly key: string;
  readonly intensity: 0 | 1 | 2 | 3 | 4;
  readonly isToday: boolean;
}

const HEATMAP_WEEKS = 52;

/** Success-based ramp, never the accent — matches this design system's own heatmap convention. */
const HEATMAP_BACKGROUNDS = [
  'var(--vox-surface-2)',
  'var(--vox-surface-4)',
  'var(--vox-success-dim)',
  'color-mix(in oklab, var(--vox-success) 55%, var(--vox-success-dim))',
  'var(--vox-success)',
] as const;

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [VoxIconComponent, IonContent],
})
export class ProfilePage implements ViewWillEnter {
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  protected readonly journal = inject(WorkoutJournalService);

  protected readonly profile = this.auth.profile;

  /** Workouts / Streak / PRs hero stats — derived client-side from data already loaded via `journal.refresh()`. */
  protected readonly heroStats = computed(() => {
    const sessions = this.journal.sessions();
    const prs = sessions.filter((s) => (s.exercises_logged ?? []).some((e) => e.is_pr)).length;
    return [
      { label: 'Workouts', value: sessions.length },
      { label: 'Streak', value: this.journal.streak().days },
      { label: 'PRs', value: prs },
    ];
  });

  /** 52 weeks × 7 days, oldest-first, flattened column-major so `grid-flow-col` renders it directly. */
  protected readonly heatmapCells = computed((): HeatmapCellVm[] => {
    const counts = new Map<string, number>();
    for (const s of this.journal.sessions()) {
      if (!s.date) continue;
      counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
    }

    const today = new Date();
    const todayKey = parseLocalDateKey(today);
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    const gridStart = new Date(currentWeekStart);
    gridStart.setDate(currentWeekStart.getDate() - (HEATMAP_WEEKS - 1) * 7);

    const cells: HeatmapCellVm[] = [];
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + w * 7 + d);
        const key = parseLocalDateKey(date);
        cells.push({ key, intensity: intensityForCount(counts.get(key) ?? 0), isToday: key === todayKey });
      }
    }
    return cells;
  });

  protected readonly heatmapLegendColors = HEATMAP_BACKGROUNDS;

  protected heatmapCellBackground(cell: HeatmapCellVm): string {
    return HEATMAP_BACKGROUNDS[cell.intensity];
  }

  protected readonly goalRows = computed(() => {
    const p = this.profile();
    const weekKeys = new Set(getCurrentWeekDayKeys());
    const sessionsThisWeek = this.journal.sessions().filter((s) => s.date && weekKeys.has(s.date)).length;

    const cals =
      p?.target_calories != null && p.target_calories > 0
        ? `${Math.round(p.target_calories).toLocaleString()} kcal`
        : 'Set targets in onboarding';
    const prot =
      p?.target_protein_g != null && p.target_protein_g > 0 ? `${Math.round(p.target_protein_g)} g` : '—';
    const carbs =
      p?.target_carbs_g != null && p.target_carbs_g > 0 ? `${Math.round(p.target_carbs_g)} g` : '—';
    const fat =
      p?.target_fat_g != null && p.target_fat_g > 0 ? `${Math.round(p.target_fat_g)} g` : '—';

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

  protected readonly displayName = computed(() => {
    return this.profile()?.display_name?.trim() || DUMMY_PROFILE_DISPLAY.name;
  });

  protected readonly email = computed(() => {
    return this.profile()?.email?.trim() || this.auth.user()?.email || DUMMY_PROFILE_DISPLAY.email;
  });

  protected readonly avatarInitial = computed(() => {
    const n = this.displayName();
    return n.trim().charAt(0).toUpperCase() || DUMMY_PROFILE_DISPLAY.initial;
  });

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
    void this.journal.refresh();
  }

  async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
      await this.navCtrl.navigateRoot('/auth/welcome', { animated: true, animationDirection: 'forward' });
    } catch (err) {
      console.error('Sign out failed', err);
    }
  }
}

function intensityForCount(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 4;
}
