import { Injectable, inject } from '@angular/core';
import { environment } from '@/environments/environment';
import type { CheckinGenerateResult, ProgressReviewRow, PlanNudgeRow } from '@/app/models';
import { SupabaseService } from '@/app/services/supabase.service';

@Injectable({ providedIn: 'root' })
export class GeminiCheckinService {
  private readonly supabase = inject(SupabaseService);

  async generate(): Promise<CheckinGenerateResult> {
    if (!environment.useGeminiEdgeFunction) {
      // Direct single-shot path is dev-only and not wired for the coach in this plan.
      throw new Error('generate-checkin requires useGeminiEdgeFunction (edge path).');
    }
    const { data, error } = await this.supabase.client.functions.invoke('generate-checkin', { body: {} });
    if (error) {
      console.error('[GeminiCheckin] Edge function error', error);
      throw new Error(error.message || 'Check-in failed');
    }
    if (data == null) throw new Error('Empty response from generate-checkin');
    if (typeof data === 'object' && 'error' in data) throw new Error(String((data as { error: unknown }).error));
    return parseCheckinRows(data);
  }
}

export function parseCheckinRows(data: unknown): CheckinGenerateResult {
  const o = (data ?? {}) as { review?: unknown; nudge?: unknown };
  if (!o.review || typeof o.review !== 'object') throw new Error('Check-in response missing review');
  // Rows come from our own table (already server-normalized); trust shape but guard JSONB bodies.
  const review = normalizeReviewRow(o.review as ProgressReviewRow);
  const nudge = o.nudge && typeof o.nudge === 'object' ? normalizeNudgeRow(o.nudge as PlanNudgeRow) : null;
  return { review, nudge };
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((s) => String(s ?? '').trim()).filter(Boolean) : [];
}
function normalizeReviewRow(r: ProgressReviewRow): ProgressReviewRow {
  const body = (r.review ?? {}) as Partial<ProgressReviewRow['review']>;
  return {
    ...r,
    review: {
      highlights: strArr(body.highlights),
      trends: strArr(body.trends),
      recurringNotes: strArr(body.recurringNotes),
      suggestions: strArr(body.suggestions),
    },
  };
}
function normalizeNudgeRow(n: PlanNudgeRow): PlanNudgeRow {
  const body = (n.nudge ?? {}) as Partial<PlanNudgeRow['nudge']>;
  return {
    ...n,
    nudge: {
      executionNotes: strArr(body.executionNotes),
      focusThisWeek: strArr(body.focusThisWeek),
      driftReason: String(body.driftReason ?? '').trim(),
    },
  };
}
