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
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
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
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  loading = false;
  errorMessage = '';

  async submit(): Promise<void> {
    this.errorMessage = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signInWithEmail(email, password);
      const p = this.auth.profile();
      await this.router.navigateByUrl(p?.onboarding_completed ? '/tabs/home' : '/auth/onboarding');
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : 'Sign-in failed';
    } finally {
      this.loading = false;
    }
  }
}
