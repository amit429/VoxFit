import { Injectable, inject, signal } from '@angular/core';
import type {
  TrainingStatsSummary,
  WorkoutPlanGenerateResult,
  WorkoutPlanRow,
  WorkoutPlanSource,
} from '@/app/models';
import { environment } from '@/environments/environment';
import { AuthService } from '@/app/services/auth.service';
import { SupabaseService } from '@/app/services/supabase.service';
import { GeminiWorkoutPlanService } from '@/app/services/gemini-workout-plan.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';
import { buildTrainingStatsSummary } from '@/app/utils/training-stats.util';
import { parseLocalDateKey } from '@/app/utils/workout-display.util';

const PLAN_WINDOW_WEEKS = 10;
const PLAN_COVERAGE_DAYS = 28;

/** Pure helper: the plan's coverage window as YYYY-MM-DD strings. */
export function planWindowDates(today: Date, coverageDays: number): { start_date: string; end_date: string } {
  const end = new Date(today);
  end.setDate(end.getDate() + coverageDays);
  return { start_date: parseLocalDateKey(today), end_date: parseLocalDateKey(end) };
}

@Injectable({ providedIn: 'root' })
export class WorkoutPlanService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly gemini = inject(GeminiWorkoutPlanService);
  private readonly journal = inject(WorkoutJournalService);

  readonly activePlan = signal<WorkoutPlanRow | null>(null);

  async getActivePlan(): Promise<WorkoutPlanRow | null> {
    const uid = this.auth.user()?.id;
    if (!uid) return null;
    const { data, error } = await this.supabase.client
      .from('workout_plans')
      .select('*')
      .eq('user_id', uid)
      .eq('status', 'active')
      .maybeSingle();
    if (error) {
      console.error('[WorkoutPlan] getActive', error);
      throw new Error(error.message);
    }
    const row = (data as WorkoutPlanRow | null) ?? null;
    this.activePlan.set(row);
    return row;
  }

  /**
   * Runs the agent (edge) or single-shot (direct) and returns a normalized, unsaved result.
   * `targetDaysPerWeek` is the user-chosen training frequency for this generation.
   */
  async generate(targetDaysPerWeek: number): Promise<WorkoutPlanGenerateResult> {
    const uid = this.auth.user()?.id;
    if (!uid) throw new Error('Not signed in');
    // Edge path rebuilds stats server-side and would discard a client summary — skip building it.
    const summary = environment.useGeminiEdgeFunction ? undefined : await this.buildClientSummary(uid);
    return this.gemini.generate(summary, targetDaysPerWeek);
  }

  /** Supersede any current active plan, then insert the new one as active. */
  async save(result: WorkoutPlanGenerateResult, source: WorkoutPlanSource): Promise<WorkoutPlanRow> {
    const uid = this.auth.user()?.id;
    if (!uid) throw new Error('Not signed in');

    const { error: supErr } = await this.supabase.client
      .from('workout_plans')
      .update({ status: 'superseded' })
      .eq('user_id', uid)
      .eq('status', 'active');
    if (supErr) throw new Error(supErr.message);

    const { start_date, end_date } = planWindowDates(new Date(), PLAN_COVERAGE_DAYS);
    const { data, error } = await this.supabase.client
      .from('workout_plans')
      .insert({
        user_id: uid,
        status: 'active',
        source,
        start_date,
        end_date,
        ai_rationale: result.aiRationale,
        plan: result.plan,
        stats_snapshot: result.statsSnapshot,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    const row = data as WorkoutPlanRow;
    this.activePlan.set(row);
    return row;
  }

  private async buildClientSummary(uid: string): Promise<TrainingStatsSummary> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - PLAN_WINDOW_WEEKS * 7);
    const sessions = await this.journal.listSessionsInRange(uid, parseLocalDateKey(from), parseLocalDateKey(to));
    return buildTrainingStatsSummary({
      sessions,
      profile: this.auth.profile(),
      windowWeeks: PLAN_WINDOW_WEEKS,
    });
  }
}
