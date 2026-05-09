import { Injectable, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '@/app/services/supabase.service';
import type { UserProfile } from '@/app/models/user.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly authReady = signal(false);

  private readyResolve!: () => void;
  readonly whenReady: Promise<void> = new Promise((resolve) => {
    this.readyResolve = resolve;
  });

  constructor(private readonly supabase: SupabaseService) {}

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

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<{ needsEmailConfirmation: boolean }> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName?.trim() || '' },
      },
    });
    if (error) {
      throw error;
    }
    if (data.session) {
      await this.refreshProfile();
      return { needsEmailConfirmation: false };
    }
    return { needsEmailConfirmation: true };
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

  async completeOnboarding(patch: {
    display_name?: string;
    sport_type: UserProfile['sport_type'];
    goal: UserProfile['goal'];
    target_protein_g: number;
    target_calories: number;
  }): Promise<void> {
    const uid = this.user()?.id;
    if (!uid) {
      throw new Error('Not signed in');
    }
    const { error } = await this.supabase.client
      .from('user_profiles')
      .update({
        display_name: patch.display_name?.trim() || null,
        sport_type: patch.sport_type,
        goal: patch.goal,
        target_protein_g: patch.target_protein_g,
        target_calories: patch.target_calories,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', uid);
    if (error) {
      throw error;
    }
    await this.refreshProfile();
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/login` : undefined,
    });
    if (error) {
      throw error;
    }
  }
}
