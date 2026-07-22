import { Component, computed, input } from '@angular/core';
import { addIcons } from 'ionicons';
import { checkmarkCircle, ellipseOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { evaluatePasswordRules, passwordStrengthLabel } from '@/app/utils/password-strength.util';

addIcons({ checkmarkCircle, ellipseOutline });

/** Live pass/fail checklist + strength label for a password field — used by register and reset-password. */
@Component({
  selector: 'app-password-strength-checklist',
  standalone: true,
  imports: [VoxIconComponent],
  templateUrl: './password-strength-checklist.component.html',
})
export class PasswordStrengthChecklistComponent {
  readonly password = input.required<string>();

  protected readonly rules = computed(() => evaluatePasswordRules(this.password()));
  protected readonly strengthLabel = computed(() => passwordStrengthLabel(this.password()));
}
