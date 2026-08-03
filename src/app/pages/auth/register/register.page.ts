import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { PasswordStrengthChecklistComponent } from '@/app/components/password-strength-checklist/password-strength-checklist.component';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonInput, IonInputPasswordToggle, IonBackButton } from '@ionic/angular/standalone';
import { catchError, debounceTime, distinctUntilChanged, from, of, switchMap } from 'rxjs';
import { AuthService } from '@/app/services/auth.service';
import { PASSWORD_MIN_LENGTH, passwordStrengthValidator } from '@/app/utils/password-strength.util';

const EMAIL_CHECK_DEBOUNCE_MS = 400;

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

  /** True once the debounced check confirms the typed email is already registered. */
  protected readonly emailTaken = signal(false);
  protected readonly checkingEmail = signal(false);

  constructor() {
    this.form.controls.email.valueChanges
      .pipe(
        debounceTime(EMAIL_CHECK_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((value) => {
          this.emailTaken.set(false);
          if (this.form.controls.email.invalid) {
            this.checkingEmail.set(false);
            return of(false);
          }
          this.checkingEmail.set(true);
          return from(this.auth.checkEmailExists(value)).pipe(catchError(() => of(false)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((exists) => {
        this.checkingEmail.set(false);
        this.emailTaken.set(exists);
      });
  }

  loading = false;
  errorMessage = '';
  infoMessage = '';

  async submit(): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';
    if (this.form.invalid || this.emailTaken()) {
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
