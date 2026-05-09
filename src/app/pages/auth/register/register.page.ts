import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonInput,
  IonToolbar,
  IonBackButton,
  IonButtons,
} from '@ionic/angular/standalone';
import { AuthService } from '@/app/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonInput,
    IonBackButton,
    IonButtons,
  ],
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  loading = false;
  errorMessage = '';
  infoMessage = '';

  async submit(): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    try {
      const { email, password, displayName } = this.form.getRawValue();
      const { needsEmailConfirmation } = await this.auth.signUpWithEmail(email, password, displayName);
      if (needsEmailConfirmation) {
        this.infoMessage = 'Check your email to confirm, then sign in.';
        return;
      }
      await this.router.navigateByUrl('/auth/onboarding');
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : 'Could not create account';
    } finally {
      this.loading = false;
    }
  }
}
