import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '@/app/services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady;
  if (!auth.session()) {
    return router.createUrlTree(['/auth/welcome']);
  }
  return true;
};

/** For login/register/welcome — signed-in users skip these. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady;
  if (!auth.session()) {
    return true;
  }
  if (!auth.profile()) {
    await auth.refreshProfile();
  }
  const p = auth.profile();
  if (p && !p.onboarding_completed) {
    return router.createUrlTree(['/auth/onboarding']);
  }
  return router.createUrlTree(['/tabs/home']);
};

/** Onboarding screen — must be signed in; completes app setup. */
export const onboardingPageGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady;
  if (!auth.session()) {
    return router.createUrlTree(['/auth/welcome']);
  }
  if (!auth.profile()) {
    await auth.refreshProfile();
  }
  if (auth.profile()?.onboarding_completed) {
    return router.createUrlTree(['/tabs/home']);
  }
  return true;
};

/** Tabs and main app — must finish onboarding. */
export const onboardingCompleteGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady;
  if (!auth.session()) {
    return router.createUrlTree(['/auth/welcome']);
  }
  if (!auth.profile()) {
    await auth.refreshProfile();
  }
  const p = auth.profile();
  if (!p?.onboarding_completed) {
    return router.createUrlTree(['/auth/onboarding']);
  }
  return true;
};
