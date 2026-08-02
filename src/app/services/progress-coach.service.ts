import { Injectable, inject, signal } from '@angular/core';
import type { CheckinGenerateResult, ProgressReviewRow, PlanNudgeRow } from '@/app/models';
import { AuthService } from '@/app/services/auth.service';
import { SupabaseService } from '@/app/services/supabase.service';
import { GeminiCheckinService } from '@/app/services/gemini-checkin.service';

@Injectable({ providedIn: 'root' })
export class ProgressCoachService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly gemini = inject(GeminiCheckinService);

  readonly latestReview = signal<ProgressReviewRow | null>(null);
  readonly latestNudge = signal<PlanNudgeRow | null>(null);

  /** Loads the most recent review and nudge for the Profile/Train cards. */
  async getLatest(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    const [{ data: review }, { data: nudge }] = await Promise.all([
      this.supabase.client.from('progress_reviews').select('*')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      this.supabase.client.from('plan_nudges').select('*')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    this.latestReview.set((review as ProgressReviewRow | null) ?? null);
    this.latestNudge.set((nudge as PlanNudgeRow | null) ?? null);
  }

  /** Manual "Check my progress" — runs the agent, persists (idempotent), updates signals. */
  async generate(): Promise<CheckinGenerateResult> {
    const uid = this.auth.user()?.id;
    if (!uid) throw new Error('Not signed in');
    const result = await this.gemini.generate();
    this.latestReview.set(result.review);
    this.latestNudge.set(result.nudge);
    return result;
  }

  async acknowledgeReview(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('progress_reviews')
      .update({ acknowledged_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    const cur = this.latestReview();
    if (cur?.id === id) this.latestReview.set({ ...cur, acknowledged_at: new Date().toISOString() });
  }

  async acknowledgeNudge(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('plan_nudges')
      .update({ acknowledged_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    const cur = this.latestNudge();
    if (cur?.id === id) this.latestNudge.set({ ...cur, acknowledged_at: new Date().toISOString() });
  }
}
