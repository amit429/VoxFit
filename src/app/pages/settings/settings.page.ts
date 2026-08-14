import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonContent, IonInput, NavController, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  logOutOutline,
  trashOutline,
  compassOutline,
  micOutline,
  restaurantOutline,
} from 'ionicons/icons';
import { AuthService } from '@/app/services/auth.service';
import { TourService } from '@/app/services/tour.service';
import type { GoalType, TourKey } from '@/app/models';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxStepperRowComponent } from '@/app/components/vox-stepper-row/vox-stepper-row.component';

addIcons({
  chevronBackOutline,
  chevronForwardOutline,
  logOutOutline,
  trashOutline,
  compassOutline,
  micOutline,
  restaurantOutline,
});

interface ChipOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/**
 * The four macro targets, driven by steppers instead of number inputs. Bounds
 * mirror the form validators so a stepper can never produce an invalid value.
 */
const TARGET_ROWS = [
  { control: 'targetCalories', label: 'Calories', emoji: '🔥', tint: 'rgba(232,160,85,.15)', unit: '', step: 50, max: 8000 },
  { control: 'targetProtein', label: 'Protein', emoji: '🥚', tint: 'rgba(63,182,143,.15)', unit: 'g', step: 5, max: 400 },
  { control: 'targetCarbs', label: 'Carbs', emoji: '🍚', tint: 'rgba(107,146,214,.15)', unit: 'g', step: 10, max: 1000 },
  { control: 'targetFat', label: 'Fat', emoji: '🥑', tint: 'rgba(217,117,103,.15)', unit: 'g', step: 5, max: 200 },
] as const;

/**
 * The weekly session target sits in its own group: it is a training goal, not
 * a nutrition target, and it drives the progress ring rather than the fuel
 * screen. Bounds mirror the DB check constraint (1–14).
 */
const WEEKLY_TARGET_ROW = {
  control: 'weeklyTarget',
  label: 'Sessions per week',
  emoji: '🎯',
  tint: 'rgba(136,123,252,.15)',
  unit: '',
  step: 1,
  min: 1,
  max: 14,
} as const;

type TargetControl = (typeof TARGET_ROWS)[number]['control'];

const GOAL_OPTIONS: readonly ChipOption<GoalType>[] = [
  { value: 'bulk', label: 'Build muscle' },
  { value: 'cut', label: 'Fat loss' },
  { value: 'maintain', label: 'Maintain' },
];

/** Keep in sync with `package.json`'s `version` — bumped manually at release, not read at runtime. */
const APP_VERSION = '1.0.0';

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonInput,
    VoxIconComponent,
    VoxCardComponent,
    VoxBadgeComponent,
    VoxStepperRowComponent,
  ],
})
export class SettingsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  private readonly toastCtrl = inject(ToastController);
  private readonly tourService = inject(TourService);

  protected readonly goalOptions = GOAL_OPTIONS;
  protected readonly appVersion = APP_VERSION;

  protected readonly saving = signal(false);
  protected readonly signingOut = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleteConfirmText = signal('');
  protected readonly deletingAccount = signal(false);
  protected readonly deleteConfirmValid = computed(() => this.deleteConfirmText() === 'DELETE');

  protected onDeleteConfirmInput(value: string): void {
    this.deleteConfirmText.set(value);
  }

  protected openDeleteConfirm(): void {
    this.confirmingDelete.set(true);
    this.deleteConfirmText.set('');
  }

  protected cancelDeleteConfirm(): void {
    this.confirmingDelete.set(false);
    this.deleteConfirmText.set('');
  }

  protected async confirmDeleteAccount(): Promise<void> {
    if (!this.deleteConfirmValid() || this.deletingAccount()) return;
    this.deletingAccount.set(true);
    try {
      await this.auth.deleteAccount();
      await this.navCtrl.navigateRoot('/auth/welcome', { animated: true, animationDirection: 'forward' });
      await this.presentToast('Account deleted', 'success');
    } catch (err) {
      console.error('Delete account failed', err);
      const msg = err instanceof Error ? err.message : 'Could not delete account';
      await this.presentToast(msg, 'danger');
    } finally {
      this.deletingAccount.set(false);
    }
  }

  readonly form = this.fb.nonNullable.group({
    displayName: [''],
    goal: this.fb.nonNullable.control<GoalType>('maintain', Validators.required),
    heightCm: this.fb.control<number | null>(null, [Validators.min(50), Validators.max(300)]),
    weightKg: this.fb.control<number | null>(null, [Validators.min(20), Validators.max(500)]),
    targetCalories: [2500, [Validators.required, Validators.min(800), Validators.max(8000)]],
    targetProtein: [160, [Validators.required, Validators.min(40), Validators.max(400)]],
    targetCarbs: [250, [Validators.required, Validators.min(0), Validators.max(1000)]],
    targetFat: [65, [Validators.required, Validators.min(0), Validators.max(200)]],
    weeklyTarget: [4, [Validators.required, Validators.min(1), Validators.max(14)]],
  });

  /**
   * Read-only, mirrors the DB-generated column. A plain method rather than a
   * `computed()` — the form controls are not signals, so a computed would
   * never see them change; this page uses default change detection, so a
   * template-called method re-evaluates on every keystroke instead.
   */
  protected bmi(): number | null {
    const h = this.form.controls.heightCm.value;
    const w = this.form.controls.weightKg.value;
    if (!h || !w || h <= 0) return null;
    return Math.round((w / (h / 100) ** 2) * 10) / 10;
  }

  ngOnInit(): void {
    const p = this.auth.profile();
    if (p) {
      this.form.patchValue({
        displayName: p.display_name ?? '',
        goal: p.goal ?? 'maintain',
        heightCm: p.height_cm,
        weightKg: p.weight_kg,
        targetCalories: p.target_calories,
        targetProtein: p.target_protein_g,
        targetCarbs: p.target_carbs_g,
        targetFat: p.target_fat_g,
        weeklyTarget: p.weekly_session_target,
      });
    }
  }

  protected readonly targetRows = TARGET_ROWS;
  protected readonly weeklyTargetRow = WEEKLY_TARGET_ROW;

  protected get weeklyTargetValue(): number {
    return this.form.controls.weeklyTarget.value;
  }

  protected setWeeklyTarget(next: number): void {
    this.form.controls.weeklyTarget.setValue(next);
    this.form.controls.weeklyTarget.markAsDirty();
  }

  protected readonly email = computed(() => this.auth.profile()?.email ?? '');

  protected targetValue(control: TargetControl): number {
    return this.form.controls[control].value;
  }

  protected setTarget(control: TargetControl, next: number): void {
    this.form.controls[control].setValue(next);
    this.form.controls[control].markAsDirty();
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
        goal: v.goal,
        height_cm: v.heightCm,
        weight_kg: v.weightKg,
        target_calories: v.targetCalories,
        target_protein_g: v.targetProtein,
        target_carbs_g: v.targetCarbs,
        target_fat_g: v.targetFat,
        weekly_session_target: v.weeklyTarget,
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

  private static readonly TOUR_ROUTE: Record<TourKey, string> = {
    orientation: '/tabs/home',
    workout: '/voice',
    meal: '/tabs/diet',
  };

  /** Requests the tour, then navigates to the page it targets — that page picks it up on arrival via TourService.takeReplay. */
  protected replayTour(tour: TourKey): void {
    this.tourService.requestReplay(tour);
    void this.navCtrl.navigateForward(SettingsPage.TOUR_ROUTE[tour], { animated: true });
  }

  protected async signOut(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.auth.signOut();
      await this.navCtrl.navigateRoot('/auth/welcome', { animated: true, animationDirection: 'forward' });
    } catch (err) {
      console.error('Sign out failed', err);
    } finally {
      this.signingOut.set(false);
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
