import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonInput,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { AuthService } from '@/app/services/auth.service';
import type { GoalType } from '@/app/models';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  imports: [
    ReactiveFormsModule,
    VoxPageHeaderComponent,
    IonContent,
    IonInput,
    IonSelect,
    IonSelectOption,
  ],
})
export class OnboardingPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    displayName: [''],
    goal: this.fb.nonNullable.control<GoalType>('maintain', Validators.required),
    /* Bounds mirror the DB check constraints so the form cannot submit a
       value the database will reject. */
    heightCm: [175, [Validators.required, Validators.min(50), Validators.max(300)]],
    weightKg: [75, [Validators.required, Validators.min(20), Validators.max(500)]],
    targetProtein: [160, [Validators.required, Validators.min(40), Validators.max(400)]],
    targetCalories: [2500, [Validators.required, Validators.min(800), Validators.max(8000)]],
    weeklyTarget: [4, [Validators.required, Validators.min(1), Validators.max(14)]],
  });

  /** 2–7 covers realistic training weeks; the column allows 1–14. */
  protected readonly weeklyTargetOptions = [2, 3, 4, 5, 6, 7] as const;

  protected selectWeeklyTarget(n: number): void {
    this.form.controls.weeklyTarget.setValue(n);
    this.form.controls.weeklyTarget.markAsDirty();
  }

  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    const p = this.auth.profile();
    if (p) {
      this.form.patchValue({
        displayName: p.display_name ?? '',
        goal: p.goal ?? 'maintain',
        heightCm: p.height_cm ?? 175,
        weightKg: p.weight_kg ?? 75,
        targetProtein: p.target_protein_g,
        targetCalories: p.target_calories,
        weeklyTarget: p.weekly_session_target,
      });
    }
  }

  async submit(): Promise<void> {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    try {
      const v = this.form.getRawValue();
      await this.auth.completeOnboarding({
        display_name: v.displayName || undefined,
        goal: v.goal,
        height_cm: v.heightCm,
        weight_kg: v.weightKg,
        target_protein_g: v.targetProtein,
        target_calories: v.targetCalories,
        weekly_session_target: v.weeklyTarget,
      });
      await this.router.navigateByUrl('/tabs/home');
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : 'Could not save profile';
    } finally {
      this.loading = false;
    }
  }
}
