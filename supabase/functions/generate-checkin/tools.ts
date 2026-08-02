import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  computeTrainingStats,
  computeNutritionStats,
  computePlanVsActual,
  type TrainingStatsSummary,
} from './stats.ts';
import type { ToolDef } from './agent.ts';

const WINDOW_WEEKS = 8;   // coach window (tunable cost/quality knob)
const NUTRITION_DAYS = 30;
const TOP_N = 6;

export interface CheckinToolset {
  tools: ToolDef[];
  lastTrainingSnapshot: () => TrainingStatsSummary | null;
  lastPlan: () => { id: string; plan: { days?: unknown[] }; created_at: string } | null;
  lastPlanVsActual: () => { planned: number; completed: number; suggestsRefresh: boolean } | null;
}

export function buildCheckinTools(supabase: SupabaseClient, userId: string): CheckinToolset {
  let trainingSnapshot: TrainingStatsSummary | null = null;
  let activePlan: { id: string; plan: { days?: unknown[] }; created_at: string } | null = null;
  let pva: { planned: number; completed: number; suggestsRefresh: boolean } | null = null;

  const getTrainingStats: ToolDef = {
    declaration: {
      name: 'get_training_stats',
      description:
        'Returns the athlete’s recent training digest: session count, avg sessions/week, weekly volume, PR count, and top exercises with their most recent weight/reps. Call this first.',
      parameters: {
        type: 'object',
        properties: { weeks: { type: 'number', description: `Lookback window in weeks (default ${WINDOW_WEEKS}).` } },
      },
    },
    run: async (args) => {
      const weeks = clampWeeks(args['weeks']);
      const fromDate = isoDaysAgo(weeks * 7);
      const { data: sessions, error } = await supabase
        .from('workout_sessions')
        .select('date, physical_flags, exercises_logged (exercise_name, exercise_type, sets, reps, weight_kg, is_pr)')
        .eq('user_id', userId)
        .gte('date', fromDate)
        .order('date', { ascending: true });
      if (error) throw new Error(error.message);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('goal, sport_type, target_calories, target_protein_g')
        .eq('id', userId)
        .maybeSingle();

      trainingSnapshot = computeTrainingStats((sessions ?? []) as never, (profile ?? null) as never, weeks, TOP_N);
      return trainingSnapshot;
    },
  };

  const getRecurringNotes: ToolDef = {
    declaration: {
      name: 'get_recurring_notes',
      description:
        'Returns the athlete’s recent physical-flag notes (free text they said mid-workout, e.g. "knee felt off"), deduplicated. Use to avoid heavily loading a flagged movement.',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const fromDate = isoDaysAgo(WINDOW_WEEKS * 7);
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('physical_flags')
        .eq('user_id', userId)
        .gte('date', fromDate);
      if (error) throw new Error(error.message);
      const set = new Set<string>();
      for (const r of data ?? []) for (const f of (r.physical_flags ?? []) as string[]) {
        const t = f.trim();
        if (t) set.add(t);
      }
      return { flags: [...set] };
    },
  };

  const getNutritionStats: ToolDef = {
    declaration: {
      name: 'get_nutrition_stats',
      description:
        'Returns the athlete’s recent nutrition adherence: distinct days logged in the window, average calories & protein vs. their targets. Averages are null when nothing was logged.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', description: `Lookback window in days (default ${NUTRITION_DAYS}).` } },
      },
    },
    run: async (args) => {
      const days = clampDays(args['days']);
      const fromDate = isoDaysAgo(days);
      const { data, error } = await supabase
        .from('diet_logs')
        .select('date, calories, protein_g') // confirmed columns on diet_logs
        .eq('user_id', userId)
        .gte('date', fromDate);
      if (error) throw new Error(error.message);
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('target_calories, target_protein_g')
        .eq('id', userId)
        .maybeSingle();
      return computeNutritionStats((data ?? []) as never, (profile ?? null) as never, days);
    },
  };

  const getActivePlan: ToolDef = {
    declaration: {
      name: 'get_active_plan',
      description:
        'Returns the athlete’s current active workout plan (day count + focuses) if one exists, else null. Use to coach execution of THAT plan.',
      parameters: { type: 'object', properties: {} },
    },
    run: async () => {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('id, plan, created_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw new Error(error.message);
      activePlan = (data as typeof activePlan) ?? null;
      return activePlan ?? { active: null };
    },
  };

  const getPlanVsActual: ToolDef = {
    declaration: {
      name: 'get_plan_vs_actual',
      description:
        'Compares the active plan’s intended weekly session count against sessions actually logged in the window → adherence % and a drift signal. Returns { active:null } when there is no active plan.',
      parameters: {
        type: 'object',
        properties: { weeks: { type: 'number', description: `Window in weeks (default ${WINDOW_WEEKS}).` } },
      },
    },
    run: async (args) => {
      const weeks = clampWeeks(args['weeks']);
      // Ensure we have the plan (agent may call this without get_active_plan first).
      if (!activePlan) {
        const { data } = await supabase
          .from('workout_plans').select('id, plan, created_at')
          .eq('user_id', userId).eq('status', 'active').maybeSingle();
        activePlan = (data as typeof activePlan) ?? null;
      }
      if (!activePlan) { pva = null; return { active: null }; }
      const plannedPerWeek = Array.isArray(activePlan.plan?.days) ? activePlan.plan.days.length : 0;
      // Cap the measurement window at the plan's age so a brand-new plan isn't flagged as
      // severe drift just because it hasn't existed for the full lookback window yet.
      const planCreated = activePlan.created_at ? activePlan.created_at.slice(0, 10) : isoDaysAgo(weeks * 7);
      const planAgeDays = Math.floor(
        (Date.now() - new Date(`${planCreated}T00:00:00`).getTime()) / 86_400_000,
      );
      const effectiveWeeks = Math.max(1, Math.min(weeks, Math.ceil(planAgeDays / 7)));
      const windowFromDate = isoDaysAgo(weeks * 7);
      // Never count sessions logged before the plan existed.
      const countFromDate = planCreated > windowFromDate ? planCreated : windowFromDate;
      const { count, error } = await supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('date', countFromDate);
      if (error) throw new Error(error.message);
      const result = computePlanVsActual(plannedPerWeek, count ?? 0, effectiveWeeks);
      pva = { planned: result.plannedSessions, completed: result.completedSessions, suggestsRefresh: result.drift === 'severe' };
      return result;
    },
  };

  return {
    tools: [getTrainingStats, getNutritionStats, getRecurringNotes, getActivePlan, getPlanVsActual],
    lastTrainingSnapshot: () => trainingSnapshot,
    lastPlan: () => activePlan,
    lastPlanVsActual: () => pva,
  };
}

function clampWeeks(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return WINDOW_WEEKS;
  return Math.min(16, Math.max(4, Math.round(n)));
}
function clampDays(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return NUTRITION_DAYS;
  return Math.min(60, Math.max(7, Math.round(n)));
}
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export { createClient };
