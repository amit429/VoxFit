import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { AuthService } from '@/app/services/auth.service';
import type { GoalType, SportType } from '@/app/models/user.models';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  imports: [
    ReactiveFormsModule,
    VoxPageHeaderComponent,
    IonContent,
    IonButton,
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
    sportType: this.fb.nonNullable.control<SportType>('gym', Validators.required),
    goal: this.fb.nonNullable.control<GoalType>('maintain', Validators.required),
    targetProtein: [160, [Validators.required, Validators.min(40), Validators.max(400)]],
    targetCalories: [2500, [Validators.required, Validators.min(800), Validators.max(8000)]],
  });

  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    const p = this.auth.profile();
    if (p) {
      this.form.patchValue({
        displayName: p.display_name ?? '',
        sportType: p.sport_type ?? 'gym',
        goal: p.goal ?? 'maintain',
        targetProtein: p.target_protein_g,
        targetCalories: p.target_calories,
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
        sport_type: v.sportType,
        goal: v.goal,
        target_protein_g: v.targetProtein,
        target_calories: v.targetCalories,
      });
      await this.router.navigateByUrl('/tabs/home');
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : 'Could not save profile';
    } finally {
      this.loading = false;
    }
  }
}
