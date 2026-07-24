import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { PasswordRuleResult } from '@/app/models';

/** Must match the Supabase Auth project's "Minimum password length" setting exactly. */
export const PASSWORD_MIN_LENGTH = 15;

/**
 * Small denylist of the most commonly breached/guessed passwords. This is a coarse
 * client-side guard, not a substitute for server-side breach checking — enable Supabase
 * Auth's "leaked password protection" (HaveIBeenPwned) for real breach-list coverage.
 */
const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyuiop', 'letmein', 'letmein1', 'welcome1', 'iloveyou',
  'admin123', 'changeme', 'abc12345', 'abcd1234', 'football1', 'baseball1',
  'trustno1', 'monkey123', 'dragon123', 'sunshine1', 'princess1', '1q2w3e4r',
  'passw0rd', 'p@ssw0rd', 'starwars1', 'superman1',
]);

/** Evaluated fresh on every keystroke — keep it cheap (no network/async work here). */
export function evaluatePasswordRules(password: string): PasswordRuleResult[] {
  const lower = password.toLowerCase();
  return [
    { key: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, passed: password.length >= PASSWORD_MIN_LENGTH },
    { key: 'upper', label: 'One uppercase letter (A–Z)', passed: /[A-Z]/.test(password) },
    { key: 'lower', label: 'One lowercase letter (a–z)', passed: /[a-z]/.test(password) },
    { key: 'number', label: 'One number (0–9)', passed: /[0-9]/.test(password) },
    { key: 'symbol', label: 'One symbol (e.g. ! ? # $ %)', passed: /[^A-Za-z0-9]/.test(password) },
    {
      key: 'notCommon',
      label: 'Not a commonly used password',
      passed: password.length === 0 || !COMMON_WEAK_PASSWORDS.has(lower),
    },
  ];
}

export function passwordStrengthScore(password: string): number {
  const rules = evaluatePasswordRules(password);
  return rules.filter((r) => r.passed).length;
}

/** Indexed by rule-pass count (0–6, see `evaluatePasswordRules`). */
const STRENGTH_LABELS = ['Very weak', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'] as const;

export function passwordStrengthLabel(password: string): string {
  if (!password) return '';
  return STRENGTH_LABELS[passwordStrengthScore(password)] ?? STRENGTH_LABELS[0];
}

/** Reactive Forms validator: fails while any rule is unmet, empty value delegates to `Validators.required`. */
export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (!value) return null;
    const failed = evaluatePasswordRules(value).filter((r) => !r.passed);
    return failed.length === 0 ? null : { passwordRules: failed.map((r) => r.key) };
  };
}
