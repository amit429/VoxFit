import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonInput, IonBackButton } from '@ionic/angular/standalone';
import { AuthService } from '@/app/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  imports: [ReactiveFormsModule, RouterLink, VoxPageHeaderComponent, IonContent, IonInput, IonBackButton],
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
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
      const { email } = this.form.getRawValue();
      await this.auth.sendPasswordReset(email);
      this.infoMessage = 'If an account exists for that email, a reset link is on its way — check your inbox.';
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : 'Could not send reset email';
    } finally {
      this.loading = false;
    }
  }
}
