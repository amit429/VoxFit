import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { PasswordStrengthChecklistComponent } from '@/app/components/password-strength-checklist/password-strength-checklist.component';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonInput, IonInputPasswordToggle, IonBackButton } from '@ionic/angular/standalone';
import { AuthService } from '@/app/services/auth.service';
import { PASSWORD_MIN_LENGTH, passwordStrengthValidator } from '@/app/utils/password-strength.util';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    VoxPageHeaderComponent,
    PasswordStrengthChecklistComponent,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
    IonBackButton,
  ],
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, passwordStrengthValidator()]],
  });

  protected readonly minPasswordLength = PASSWORD_MIN_LENGTH;

  /** Drives the live requirements checklist — recomputed on every keystroke via the input's (ionInput) handler. */
  protected readonly passwordValue = signal('');

  protected onPasswordInput(value: string): void {
    this.passwordValue.set(value);
  }

  /*
   * The live "this email is already registered" pre-check is deliberately gone.
   *
   * It called the `email_exists` RPC before the user was signed in, which made
   * that RPC a public membership oracle over auth.users — anyone with the anon
   * key (it ships in the JS bundle) could probe any address. Migration 0014
   * revokes anon's EXECUTE, so the call can no longer succeed pre-auth and
   * keeping it would just fire a guaranteed-403 per keystroke.
   *
   * Duplicate emails are still caught, at submit: signUpWithEmail surfaces
   * "An account with this email already exists" via
   * isAlreadyRegisteredSignUpResponse. That reveals the same fact only to
   * someone who actually attempted to register that address, which is the
   * standard trade-off.
   */

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
