/// <reference path="../deno-global.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { runAgent } from './agent.ts';
import { buildPlanTools, createClient } from './tools.ts';
import { PLAN_SYSTEM } from './prompt.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!geminiKey || !supabaseUrl || !anonKey) return json({ error: 'Server not configured' }, 500);

  // Authenticate the caller: forward their JWT so RLS scopes tool queries to them.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  // Quota. This is the most expensive endpoint in the product — a multi-turn
  // agent loop with tool calls, so one request can be many model invocations.
  // The hourly allowance is deliberately much tighter than the extract/log
  // endpoints: nobody legitimately regenerates their training plan 20x an hour.
  const { data: quota, error: quotaErr } = await supabase.rpc('consume_ai_quota', {
    p_endpoint: 'generate-workout-plan',
    p_per_hour: 5,
    p_per_day: 20,
  });
  if (quotaErr) {
    // Fail closed — an outage in quota accounting is when abuse is cheapest.
    console.error('[generate-workout-plan] quota check failed', quotaErr);
    return json({ error: 'Service temporarily unavailable' }, 503);
  }
  if (!(quota as { allowed?: boolean } | null)?.allowed) {
    return json({ error: 'Rate limit exceeded. Try again later.' }, 429);
  }

  // How many training days/week the user asked for (clamped 3–6, default 5).
  let targetDaysPerWeek = 5;
  try {
    const body = (await req.json()) as { targetDaysPerWeek?: number };
    const n = Number(body?.targetDaysPerWeek);
    if (Number.isFinite(n)) targetDaysPerWeek = Math.min(6, Math.max(3, Math.round(n)));
  } catch {
    // no/invalid body → keep default
  }

  try {
    const toolset = buildPlanTools(supabase, userId);
    const finalText = await runAgent({
      apiKey: geminiKey,
      system: PLAN_SYSTEM,
      userMessage:
        `Build my training plan with EXACTLY ${targetDaysPerWeek} training days per week ` +
        `(${targetDaysPerWeek} distinct day objects, each a different focus). ` +
        'Call the tools first to ground it in my real stats, then return the plan.',
      tools: toolset.tools,
    });

    const parsed = JSON.parse(finalText) as {
      ai_rationale?: string;
      plan?: { rationale_short?: string } | null;
    };
    // The rationale now lives inside the plan body; `ai_rationale` stays in the
    // response because it maps to the plain-text column on `workout_plans`.
    // Older prompt revisions returned it at the top level — accept both.
    return json({
      ai_rationale: parsed.plan?.rationale_short ?? parsed.ai_rationale ?? '',
      plan: parsed.plan ?? { days: [] },
      stats_snapshot: { ...(toolset.lastSnapshot() ?? {}), targetDaysPerWeek },
    });
  } catch (e) {
    console.error('[generate-workout-plan]', e);
    return json({ error: e instanceof Error ? e.message : 'Generation failed' }, 502);
  }
});
