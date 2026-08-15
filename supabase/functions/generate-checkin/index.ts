/// <reference path="../deno-global.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { runAgent } from './agent.ts';
import { buildCheckinTools, createClient } from './tools.ts';
import { COACH_SYSTEM } from './prompt.ts';
import { classifyInvocation } from './auth.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

/** Monday (UTC) of the current week — the idempotency key. */
function weekStartISO(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Mon=0
  x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}
function isoDaysAgo(days: number): string {
  const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10);
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((s) => String(s ?? '').trim()).filter(Boolean) : [];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!geminiKey || !supabaseUrl || !anonKey) return json({ error: 'Server not configured' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  const body = await req.json().catch(() => ({}));
  const inv = classifyInvocation(authHeader, serviceRoleKey, body);
  if (inv.kind === 'cron_missing_user') return json({ error: 'user_id required' }, 400);

  let supabase;
  let userId: string;
  if (inv.kind === 'cron') {
    // Weekly cron: trusted server-side call. Service-role client writes for the target user.
    supabase = createClient(supabaseUrl, serviceRoleKey!);
    userId = inv.userId;
  } else {
    // Client call: RLS-scoped to the caller's own rows.
    supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);
    userId = userData.user.id;

    // Quota on the client path only — the cron path is our own trusted dispatcher
    // and metering it would let a user's manual usage suppress their weekly review.
    // Limits are loose because the week-scoped idempotency check below already
    // short-circuits repeat calls without touching the model; this only bounds the
    // uncached first-generation case.
    const { data: quota, error: quotaErr } = await supabase.rpc('consume_ai_quota', {
      p_endpoint: 'generate-checkin',
      p_per_hour: 10,
      p_per_day: 30,
    });
    if (quotaErr) {
      console.error('[generate-checkin] quota check failed', quotaErr);
      return json({ error: 'Service temporarily unavailable' }, 503);
    }
    if (!(quota as { allowed?: boolean } | null)?.allowed) {
      return json({ error: 'Rate limit exceeded. Try again later.' }, 429);
    }
  }

  const forWeek = weekStartISO();
  const periodStart = isoDaysAgo(30);
  const periodEnd = new Date().toISOString().slice(0, 10);

  try {
    // Idempotency: if this week's review already exists, return it (+ its nudge) unchanged.
    const { data: existing } = await supabase
      .from('progress_reviews').select('*')
      .eq('user_id', userId).eq('generated_for_week', forWeek).maybeSingle();
    if (existing) {
      const { data: existingNudge } = await supabase
        .from('plan_nudges').select('*')
        .eq('user_id', userId).eq('generated_for_week', forWeek).maybeSingle();
      return json({ review: existing, nudge: existingNudge ?? null });
    }

    const toolset = buildCheckinTools(supabase, userId);
    const finalText = await runAgent({
      apiKey: geminiKey,
      system: COACH_SYSTEM,
      userMessage:
        'Write my weekly progress reflection. Call get_training_stats, get_nutrition_stats and ' +
        'get_recurring_notes; if get_active_plan returns a plan, also call get_plan_vs_actual and include a nudge. ' +
        'Then return the JSON.',
      tools: toolset.tools,
    });

    const parsed = JSON.parse(finalText) as {
      headline_tone?: string;
      review?: Record<string, unknown>;
      nudge?: Record<string, unknown> | null;
    };
    const tone = parsed.headline_tone === 'positive' || parsed.headline_tone === 'attention'
      ? parsed.headline_tone : 'neutral';
    const review = {
      highlights: strArr(parsed.review?.['highlights']),
      trends: strArr(parsed.review?.['trends']),
      recurringNotes: strArr(parsed.review?.['recurringNotes']),
      suggestions: strArr(parsed.review?.['suggestions']),
    };

    // Deterministic write #1 — the review. upsert keyed on the unique (user_id, generated_for_week).
    const { data: reviewRow, error: revErr } = await supabase
      .from('progress_reviews')
      .upsert({
        user_id: userId, period_start: periodStart, period_end: periodEnd,
        generated_for_week: forWeek, headline_tone: tone, review,
        stats_snapshot: toolset.lastTrainingSnapshot() ?? {},
      }, { onConflict: 'user_id,generated_for_week' })
      .select('*').single();
    if (revErr) throw new Error(revErr.message);

    // Deterministic write #2 — the nudge, only when an active plan exists and adherence data is present.
    let nudgeRow = null;
    const plan = toolset.lastPlan();
    const pva = toolset.lastPlanVsActual();
    if (plan && pva && parsed.nudge) {
      const nudge = {
        executionNotes: strArr(parsed.nudge['executionNotes']),
        focusThisWeek: strArr(parsed.nudge['focusThisWeek']),
        driftReason: String(parsed.nudge['driftReason'] ?? '').trim(),
      };
      const { data, error: nErr } = await supabase
        .from('plan_nudges')
        .upsert({
          user_id: userId, plan_id: plan.id, period_start: periodStart, period_end: periodEnd,
          generated_for_week: forWeek, suggests_refresh: pva.suggestsRefresh,
          planned_sessions: pva.planned, completed_sessions: pva.completed, nudge,
        }, { onConflict: 'user_id,generated_for_week' })
        .select('*').single();
      if (nErr) throw new Error(nErr.message);
      nudgeRow = data;
    }

    return json({ review: reviewRow, nudge: nudgeRow });
  } catch (e) {
    console.error('[generate-checkin]', e);
    return json({ error: e instanceof Error ? e.message : 'Check-in failed' }, 502);
  }
});
