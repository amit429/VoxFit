import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { Component, computed, inject, signal } from '@angular/core';
import { NavController } from '@ionic/angular/standalone';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { IonContent } from '@ionic/angular/standalone';
import { DUMMY_PROFILE_DISPLAY } from '@/app/data/profile.mock';
import type { ProfileGoalRowMock } from '@/app/data/types';
import type { GoalType } from '@/app/models/user.models';
import { AuthService } from '@/app/services/auth.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { getCurrentWeekDayKeys } from '@/app/utils/workout-display.util';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [VoxPageHeaderComponent, IonContent],
})
export class ProfilePage implements ViewWillEnter {
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  protected readonly journal = inject(WorkoutJournalService);

  protected readonly profile = this.auth.profile;

  /** Calendar month shown on the profile heatmap. */
  protected readonly visibleMonth = signal<{ year: number; month0: number }>(
    (() => {
      const n = new Date();
      return { year: n.getFullYear(), month0: n.getMonth() };
    })(),
  );

  protected readonly calendarTitle = computed(() => {
    const { year, month0 } = this.visibleMonth();
    return new Date(year, month0, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  });

  protected readonly calendarCells = computed(() => {
    const { year, month0 } = this.visibleMonth();
    const first = new Date(year, month0, 1);
    const pad = first.getDay();
    const dim = new Date(year, month0 + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < pad; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= dim; d++) {
      cells.push(d);
    }
    return cells;
  });

  protected readonly workoutDaysInMonth = computed(() => {
    const { year, month0 } = this.visibleMonth();
    const wantM = month0 + 1;
    const days = new Set<number>();
    for (const s of this.journal.sessions()) {
      if (!s.date) continue;
      const parts = s.date.split('-').map((x) => Number(x));
      const yy = parts[0];
      const mm = parts[1];
      const dd = parts[2];
      if (yy === year && mm === wantM && dd) {
        days.add(dd);
      }
    }
    return days;
  });

  protected readonly goalRows = computed((): ProfileGoalRowMock[] => {
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
      { label: 'Daily Calories', value: cals },
      { label: 'Protein Target', value: prot },
      { label: 'Carbs Target', value: carbs },
      { label: 'Fat Target', value: fat },
      { label: 'Workouts (this week)', value: `${sessionsThisWeek} logged` },
      { label: 'Primary Goal', value: ProfilePage.formatGoalLabel(p?.goal ?? null) },
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

  protected shiftMonth(delta: number): void {
    this.visibleMonth.update((cur) => {
      const d = new Date(cur.year, cur.month0 + delta, 1);
      return { year: d.getFullYear(), month0: d.getMonth() };
    });
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
