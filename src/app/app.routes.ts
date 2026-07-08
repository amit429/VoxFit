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
        path: 'onboarding',
        canActivate: [onboardingPageGuard],
        loadComponent: () =>
          import('@/app/pages/auth/onboarding/onboarding.page').then((m) => m.OnboardingPage),
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
