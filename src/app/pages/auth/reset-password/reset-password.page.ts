import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { PasswordStrengthChecklistComponent } from '@/app/components/password-strength-checklist/password-strength-checklist.component';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonInput, IonInputPasswordToggle } from '@ionic/angular/standalone';
import { AuthService } from '@/app/services/auth.service';
import { PASSWORD_MIN_LENGTH, passwordStrengthValidator } from '@/app/utils/password-strength.util';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  imports: [
    ReactiveFormsModule,
    VoxPageHeaderComponent,
    PasswordStrengthChecklistComponent,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
  ],
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, passwordStrengthValidator()]],
  });

  protected readonly minPasswordLength = PASSWORD_MIN_LENGTH;

  /** Drives the live requirements checklist — recomputed on every keystroke via the input's (ionInput) handler. */
  protected readonly passwordValue = signal('');

  protected onPasswordInput(value: string): void {
    this.passwordValue.set(value);
  }

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
      const { password } = this.form.getRawValue();
      await this.auth.updatePassword(password);
      await this.router.navigateByUrl('/tabs/home');
    } catch (err: unknown) {
      this.errorMessage =
        err instanceof Error ? err.message : 'Could not update password — the reset link may have expired.';
    } finally {
      this.loading = false;
    }
  }
}
