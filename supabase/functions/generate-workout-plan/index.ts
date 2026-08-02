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

  try {
    const toolset = buildPlanTools(supabase, userId);
    const finalText = await runAgent({
      apiKey: geminiKey,
      system: PLAN_SYSTEM,
      userMessage: 'Generate my training plan from my real recent stats. Call the tools first.',
      tools: toolset.tools,
    });

    const parsed = JSON.parse(finalText) as { ai_rationale?: string; plan?: unknown };
    return json({
      ai_rationale: parsed.ai_rationale ?? '',
      plan: parsed.plan ?? { days: [] },
      stats_snapshot: toolset.lastSnapshot() ?? {},
    });
  } catch (e) {
    console.error('[generate-workout-plan]', e);
    return json({ error: e instanceof Error ? e.message : 'Generation failed' }, 502);
  }
});
