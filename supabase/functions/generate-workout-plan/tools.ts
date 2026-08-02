import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { computeTrainingStats, type TrainingStatsSummary } from './stats.ts';
import type { ToolDef } from './agent.ts';

const WINDOW_WEEKS = 10; // tunable cost/quality knob
const TOP_N = 6;

export interface PlanToolset {
  tools: ToolDef[];
  /** The exact stats the agent last aggregated — echoed back for stats_snapshot. */
  lastSnapshot: () => TrainingStatsSummary | null;
}

export function buildPlanTools(supabase: SupabaseClient, userId: string): PlanToolset {
  let snapshot: TrainingStatsSummary | null = null;

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

      snapshot = computeTrainingStats((sessions ?? []) as never, (profile ?? null) as never, weeks, TOP_N);
      return snapshot;
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

  return { tools: [getTrainingStats, getRecurringNotes], lastSnapshot: () => snapshot };
}

function clampWeeks(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return WINDOW_WEEKS;
  return Math.min(16, Math.max(4, Math.round(n)));
}
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export { createClient };
