import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonContent, IonInput, NavController, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, logOutOutline } from 'ionicons/icons';
import { AuthService } from '@/app/services/auth.service';
import type { GoalType, SportType } from '@/app/models';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

addIcons({ chevronBackOutline, logOutOutline });

interface ChipOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

const SPORT_OPTIONS: readonly ChipOption<SportType>[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'runner', label: 'Running' },
];

const GOAL_OPTIONS: readonly ChipOption<GoalType>[] = [
  { value: 'bulk', label: 'Build muscle' },
  { value: 'cut', label: 'Fat loss' },
  { value: 'maintain', label: 'Maintain' },
];

/** Keep in sync with `package.json`'s `version` — bumped manually at release, not read at runtime. */
const APP_VERSION = '0.0.1';

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  imports: [ReactiveFormsModule, IonContent, IonInput, VoxIconComponent],
})
export class SettingsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  private readonly toastCtrl = inject(ToastController);

  protected readonly sportOptions = SPORT_OPTIONS;
  protected readonly goalOptions = GOAL_OPTIONS;
  protected readonly appVersion = APP_VERSION;

  protected readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    displayName: [''],
    sportType: this.fb.nonNullable.control<SportType>('gym', Validators.required),
    goal: this.fb.nonNullable.control<GoalType>('maintain', Validators.required),
    targetCalories: [2500, [Validators.required, Validators.min(800), Validators.max(8000)]],
    targetProtein: [160, [Validators.required, Validators.min(40), Validators.max(400)]],
    targetCarbs: [250, [Validators.required, Validators.min(0), Validators.max(1000)]],
    targetFat: [65, [Validators.required, Validators.min(0), Validators.max(200)]],
  });

  ngOnInit(): void {
    const p = this.auth.profile();
    if (p) {
      this.form.patchValue({
        displayName: p.display_name ?? '',
        sportType: p.sport_type ?? 'gym',
        goal: p.goal ?? 'maintain',
        targetCalories: p.target_calories,
        targetProtein: p.target_protein_g,
        targetCarbs: p.target_carbs_g,
        targetFat: p.target_fat_g,
      });
    }
  }

  protected selectSport(value: SportType): void {
    this.form.controls.sportType.setValue(value);
    this.form.controls.sportType.markAsDirty();
  }

  protected selectGoal(value: GoalType): void {
    this.form.controls.goal.setValue(value);
    this.form.controls.goal.markAsDirty();
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      await this.auth.updatePreferences({
        display_name: v.displayName || undefined,
        sport_type: v.sportType,
        goal: v.goal,
        target_calories: v.targetCalories,
        target_protein_g: v.targetProtein,
        target_carbs_g: v.targetCarbs,
        target_fat_g: v.targetFat,
      });
      this.form.markAsPristine();
      await this.presentToast('Preferences saved', 'success');
    } catch (err) {
      console.error('[Settings] save preferences', err);
      const msg = err instanceof Error ? err.message : 'Could not save preferences';
      await this.presentToast(msg, 'danger');
    } finally {
      this.saving.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
      await this.navCtrl.navigateRoot('/auth/welcome', { animated: true, animationDirection: 'forward' });
    } catch (err) {
      console.error('Sign out failed', err);
    }
  }

  protected goBack(): void {
    this.navCtrl.navigateBack('/tabs/profile');
  }

  private async presentToast(message: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2800, color, position: 'bottom' });
    await t.present();
  }
}
