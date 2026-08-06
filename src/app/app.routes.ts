import { Routes } from '@angular/router';
import {
  authGuard,
  guestGuard,
  onboardingCompleteGuard,
  onboardingPageGuard,
} from '@/app/guards/auth.guards';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('@/app/pages/auth/auth-shell.component').then((m) => m.AuthShellComponent),
    children: [
      {
        path: 'welcome',
        canActivate: [guestGuard],
        loadComponent: () => import('@/app/pages/auth/welcome/welcome.page').then((m) => m.WelcomePage),
      },
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('@/app/pages/auth/login/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('@/app/pages/auth/register/register.page').then((m) => m.RegisterPage),
      },
      {
        path: 'forgot-password',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('@/app/pages/auth/forgot-password/forgot-password.page').then((m) => m.ForgotPasswordPage),
      },
      {
        path: 'reset-password',
        // Not guestGuard: a user landing here via the emailed recovery link already has a
        // (recovery) session, which guestGuard would treat as "already logged in" and bounce
        // away. authGuard just requires *some* session, which the recovery link provides.
        canActivate: [authGuard],
        loadComponent: () =>
          import('@/app/pages/auth/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
      },
      {
        path: 'onboarding',
        canActivate: [onboardingPageGuard],
        loadComponent: () =>
          import('@/app/pages/auth/onboarding/onboarding.page').then((m) => m.OnboardingPage),
      },
      {
        path: 'confirmed',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@/app/pages/auth/email-confirmed/email-confirmed.page').then((m) => m.EmailConfirmedPage),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'welcome',
      },
    ],
  },
    {
    path: 'log-diet',
    canActivate: [authGuard, onboardingCompleteGuard],
    loadComponent: () =>
      import('@/app/pages/diet-voice-log/diet-voice-log.page').then((m) => m.DietVoiceLogPage),
  },
  {
    path: 'voice',
    canActivate: [authGuard, onboardingCompleteGuard],
    loadComponent: () => import('@/app/pages/voice-log/voice-log.page').then((m) => m.VoiceLogPage),
  },
  {
    path: 'settings',
    canActivate: [authGuard, onboardingCompleteGuard],
    loadComponent: () => import('@/app/pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    // TEMP: component gallery for the UI revamp. Remove before merge.
    path: 'gallery',
    loadComponent: () => import('@/app/pages/gallery/gallery.page').then((m) => m.GalleryPage),
  },
  {
    path: 'tabs',
    loadComponent: () => import('@/app/pages/tabs/tabs.page').then((m) => m.TabsPage),
    canActivate: [authGuard, onboardingCompleteGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('@/app/pages/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'workout',
        loadComponent: () => import('@/app/pages/workout/workout.page').then((m) => m.WorkoutPage),
      },
      {
        // Must precede `workout/:sessionId` — otherwise `plan` would be captured as a sessionId.
        path: 'workout/plan',
        loadComponent: () =>
          import('@/app/pages/workout-plan/workout-plan.page').then((m) => m.WorkoutPlanPage),
      },
      {
        path: 'workout/:sessionId',
        loadComponent: () =>
          import('@/app/pages/workout-detail/workout-detail.page').then((m) => m.WorkoutDetailPage),
      },
      {
        path: 'diet',
        loadComponent: () => import('@/app/pages/diet/diet.page').then((m) => m.DietPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('@/app/pages/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home',
      },
    ],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/auth/welcome',
  },
  {
    path: '**',
    redirectTo: '/auth/welcome',
  },
];
