import { Component, computed, inject } from '@angular/core';
import { NavController } from '@ionic/angular/standalone';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
} from '@ionic/angular/standalone';
import { DUMMY_PROFILE_DISPLAY, DUMMY_PROFILE_GOALS, DUMMY_PROFILE_WORKOUT_DAYS } from '@/app/data';
import { AuthService } from '@/app/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent],
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);

  protected readonly profile = this.auth.profile;

  protected readonly dummy = {
    calendarTitle: DUMMY_PROFILE_DISPLAY.calendarTitle,
    workoutDays: DUMMY_PROFILE_WORKOUT_DAYS,
    goals: DUMMY_PROFILE_GOALS,
  };

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
    if (s === 'gym') return 'Gym-goer';
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  protected readonly goalChip = computed(() => {
    const g = this.profile()?.goal;
    if (!g) return DUMMY_PROFILE_DISPLAY.goalChip;
    return g.charAt(0).toUpperCase() + g.slice(1);
  });

  protected calendarDays(): number[] {
    return Array.from({ length: 31 }, (_, i) => i + 1);
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
