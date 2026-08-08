import { Injectable, inject, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { SupabaseService } from '@/app/services/supabase.service';
import type { UserProfile } from '@/app/models';
import { Capacitor } from '@capacitor/core';
import { buildAuthRedirectUrl } from '@/app/utils/auth-redirect.util';

/**
 * Supabase quirk: `auth.signUp()` for an email that's already registered and confirmed
 * returns no `error` — just `session: null` and a synthetic `user` whose `identities` array
 * is empty (a genuine new signup has one identity). Without this check that case is
 * indistinguishable from "check your email to confirm", so we'd tell an existing user their
 * account was just created.
 */
export function isAlreadyRegisteredSignUpResponse(data: { session: Session | null; user: User | null }): boolean {
  return !data.session && !!data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly authReady = signal(false);

  private readyResolve!: () => void;
  readonly whenReady: Promise<void> = new Promise((resolve) => {
    this.readyResolve = resolve;
  });

  async init(): Promise<void> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    this.applySession(session);
    if (session?.user) {
      await this.refreshProfile();
    }
    this.supabase.client.auth.onAuthStateChange((_event, next) => {
      void this.onSessionChange(next);
    });
    this.authReady.set(true);
    this.readyResolve();
  }

  private async onSessionChange(next: Session | null): Promise<void> {
    this.applySession(next);
    if (next?.user) {
      await this.refreshProfile();
    } else {
      this.profile.set(null);
    }
  }

  private applySession(session: Session | null): void {
    this.session.set(session);
    this.user.set(session?.user ?? null);
  }

  async refreshProfile(): Promise<void> {
    const uid = this.user()?.id;
    if (!uid) {
      this.profile.set(null);
      return;
    }
    const { data, error } = await this.supabase.client.from('user_profiles').select('*').eq('id', uid).single();
    if (error || !data) {
      this.profile.set(null);
      return;
    }
    this.profile.set(data as UserProfile);
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    await this.refreshProfile();
  }

  async setSessionFromTokens(accessToken: string, refreshToken: string): Promise<void> {
    const { error } = await this.supabase.client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      throw error;
    }
    await this.refreshProfile();
  }

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<{ needsEmailConfirmation: boolean }> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName?.trim() || '' },
        emailRedirectTo: buildAuthRedirectUrl(
          'confirmed',
          Capacitor.isNativePlatform(),
          typeof window !== 'undefined' ? window.location.origin : '',
        ),
      },
    });
    if (error) {
      throw error;
    }
    if (isAlreadyRegisteredSignUpResponse(data)) {
      throw new Error('An account with this email already exists. Try signing in instead.');
    }
    if (data.session) {
      await this.refreshProfile();
      return { needsEmailConfirmation: false };
    }
    return { needsEmailConfirmation: true };
  }

  async checkEmailExists(email: string): Promise<boolean> {
    const { data, error } = await this.supabase.client.rpc('email_exists', { check_email: email.trim().toLowerCase() });
    if (error) {
      throw error;
    }
    return Boolean(data);
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) {
      throw error;
    }
    /* Listener may lag behind Zone / microtasks; clear app state immediately so guards + UI match. */
    this.applySession(null);
    this.profile.set(null);
  }

  async deleteAccount(): Promise<void> {
    const { error } = await this.supabase.client.functions.invoke('delete-account');
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const body: unknown = await error.context.json().catch(() => null);
        const message =
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error: unknown }).error)
            : error.message;
        throw new Error(message);
      }
      throw new Error(error.message || 'Failed to delete account');
    }
    await this.supabase.client.auth.signOut({ scope: 'local' });
    this.applySession(null);
    this.profile.set(null);
  }

  async completeOnboarding(patch: {
    display_name?: string;
    sport_type: UserProfile['sport_type'];
    goal: UserProfile['goal'];
    target_protein_g: number;
    target_calories: number;
    weekly_session_target: number;
  }): Promise<void> {
    await this.writeProfilePatch({ ...patch, onboarding_completed: true });
    await this.refreshProfile();
  }

  async updatePreferences(patch: {
    display_name?: string;
    sport_type: UserProfile['sport_type'];
    goal: UserProfile['goal'];
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fat_g: number;
    weekly_session_target: number;
  }): Promise<void> {
    await this.writeProfilePatch(patch);
    await this.refreshProfile();
  }

  private async writeProfilePatch(patch: {
    display_name?: string;
    sport_type?: UserProfile['sport_type'];
    goal?: UserProfile['goal'];
    target_calories?: number;
    target_protein_g?: number;
    weekly_session_target?: number;
    target_carbs_g?: number;
    target_fat_g?: number;
    onboarding_completed?: boolean;
  }): Promise<void> {
    const uid = this.user()?.id;
    if (!uid) {
      throw new Error('Not signed in');
    }
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.display_name !== undefined) row['display_name'] = patch.display_name?.trim() || null;
    if (patch.sport_type !== undefined) row['sport_type'] = patch.sport_type;
    if (patch.goal !== undefined) row['goal'] = patch.goal;
    if (patch.target_calories !== undefined) row['target_calories'] = patch.target_calories;
    if (patch.target_protein_g !== undefined) row['target_protein_g'] = patch.target_protein_g;
    if (patch.target_carbs_g !== undefined) row['target_carbs_g'] = patch.target_carbs_g;
    if (patch.target_fat_g !== undefined) row['target_fat_g'] = patch.target_fat_g;
    if (patch.weekly_session_target !== undefined) {
      row['weekly_session_target'] = patch.weekly_session_target;
    }
    if (patch.onboarding_completed !== undefined) row['onboarding_completed'] = patch.onboarding_completed;

    const { error } = await this.supabase.client.from('user_profiles').update(row).eq('id', uid);
    if (error) {
      throw error;
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, {
      redirectTo: buildAuthRedirectUrl(
        'reset-password',
        Capacitor.isNativePlatform(),
        typeof window !== 'undefined' ? window.location.origin : '',
      ),
    });
    if (error) {
      throw error;
    }
  }

  /**
   * Sets a new password on the current session. Works both for a user who clicked a recovery
   * link (Supabase auto-establishes a temporary recovery session via `detectSessionInUrl`) and
   * for an already signed-in user changing their password directly.
   */
  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ password: newPassword });
    if (error) {
      throw error;
    }
  }
}
