/// <reference path="../deno-global.d.ts" />
/**
 * Shared request guard for every Gemini-backed edge function.
 *
 * Before this existed, `extract-workout`, `suggest-diet-meals` and `log-food`
 * accepted anonymous POSTs from any origin and forwarded them straight to
 * Gemini. That is a publicly writable LLM proxy billed to our Google account —
 * the single highest-value thing to fix before this app is public.
 *
 * Four things every AI endpoint needs, in this order:
 *   1. Origin allowlist (CORS)          — who may call from a browser
 *   2. Body size cap                    — before we parse anything
 *   3. Real user authentication         — a *user* JWT, not the public anon key
 *   4. Per-user quota                   — so one account can't drain the budget
 *
 * Note on `verify_jwt`: Supabase's platform-level flag is NOT sufficient here.
 * It accepts any validly-signed project JWT, and the anon key is exactly that —
 * a signed JWT that ships publicly in our JS bundle. So `verify_jwt` alone lets
 * anyone who views source call these endpoints. Step 3 below calls
 * `auth.getUser()`, which only succeeds for a real signed-in user's access
 * token, and that distinction is the whole point.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Origins permitted to call these functions from a browser.
 *
 * Set the `ALLOWED_ORIGINS` secret (comma-separated) to your production web
 * origin, e.g. `supabase secrets set ALLOWED_ORIGINS="https://app.voxfit.com"`.
 * The Capacitor/localhost entries below are always allowed so the Android
 * webview and local dev keep working without extra configuration.
 *
 * A request with no Origin header at all (native HTTP clients, curl, the
 * Capacitor native bridge on some Android versions) is not blocked here —
 * CORS is a browser-enforced control and cannot stop a non-browser client
 * regardless. Authentication (step 3) and quota (step 4) are what actually
 * protect the endpoint; CORS just stops a hostile *website* from spending a
 * logged-in visitor's quota via their ambient session.
 */
const STATIC_ALLOWED_ORIGINS = [
  'https://voxfit.amitpile.com',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'http://localhost:4200',
  'http://localhost:8100',
];

function configuredOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function allowedOrigins(): string[] {
  return [...STATIC_ALLOWED_ORIGINS, ...configuredOrigins()];
}

/** Largest request body we will even read, in bytes. Transcripts are speech — this is enormous for one. */
const MAX_BODY_BYTES = 32 * 1024;

/** Longest single free-text field (e.g. a voice transcript) we forward to the model. */
export const MAX_TRANSCRIPT_CHARS = 6000;

export function corsHeaders(origin: string | null): Record<string, string> {
  const list = allowedOrigins();

  let allow: string;
  if (origin && list.includes(origin)) {
    allow = origin;
  } else if (configuredOrigins().length === 0 && origin) {
    /*
     * ALLOWED_ORIGINS has not been set yet, so we cannot know this deployment's
     * real web origin. Echo the caller's origin rather than blocking it.
     *
     * This is deliberately fail-OPEN, and it is the one control here that is:
     * authentication and per-user quota (steps 3 and 4 of guardRequest) are what
     * actually stop abuse, and both still apply to every request. CORS only adds
     * defence against a hostile *website* spending a logged-in visitor's quota
     * via their ambient session. Trading that narrower protection for "the app
     * keeps working if you forget one secret" is the right way round — the
     * alternative is a misconfiguration that silently breaks every AI feature in
     * production and invites someone to revert this whole guard to fix it.
     *
     * Set the secret to close it:
     *   supabase secrets set ALLOWED_ORIGINS="https://your-domain.com"
     */
    console.warn(
      'ALLOWED_ORIGINS is not set — echoing request origin. Set it to lock CORS to your web origin.',
    );
    allow = origin;
  } else {
    // Configured, but this origin is not on the list: name an allowed origin
    // instead so the browser blocks the response. Never reflect an arbitrary
    // attacker origin, and never fall back to `*`.
    allow = list[list.length - 1];
  }

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

/** Clamp a free-text field to a sane length before it reaches the model. */
export function clampText(value: unknown, max = MAX_TRANSCRIPT_CHARS): string {
  return String(value ?? '').trim().slice(0, max);
}

export interface GuardOk {
  readonly ok: true;
  readonly userId: string;
  readonly supabase: SupabaseClient;
  readonly body: Record<string, unknown>;
  readonly origin: string | null;
}

export interface GuardFail {
  readonly ok: false;
  readonly response: Response;
}

export interface GuardOptions {
  /** Identifies this endpoint in the quota table; also the per-endpoint hourly bucket. */
  readonly endpoint: string;
  readonly perHour?: number;
  readonly perDay?: number;
}

/**
 * Runs the full guard chain. On success returns the authenticated user id, a
 * caller-scoped Supabase client (JWT forwarded, so RLS applies to any query the
 * function makes) and the parsed body. On failure returns a ready-to-send
 * Response — the caller just returns it.
 */
export async function guardRequest(
  req: Request,
  options: GuardOptions,
): Promise<GuardOk | GuardFail> {
  const origin = req.headers.get('Origin');

  if (req.method !== 'POST') {
    return { ok: false, response: jsonResponse({ error: 'Method not allowed' }, 405, origin) };
  }

  // --- 2. body size cap, before parsing ---
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, response: jsonResponse({ error: 'Payload too large' }, 413, origin) };
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    // Content-Length can lie or be absent (chunked encoding); this is the real check.
    return { ok: false, response: jsonResponse({ error: 'Payload too large' }, 413, origin) };
  }

  let body: Record<string, unknown> = {};
  if (raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return { ok: false, response: jsonResponse({ error: 'Invalid JSON body' }, 400, origin) };
    }
  }

  // --- 3. real user authentication ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return { ok: false, response: jsonResponse({ error: 'Server not configured' }, 500, origin) };
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized' }, 401, origin) };
  }

  // --- 4. per-user quota ---
  const { data: quota, error: quotaErr } = await supabase.rpc('consume_ai_quota', {
    p_endpoint: options.endpoint,
    p_per_hour: options.perHour ?? 20,
    p_per_day: options.perDay ?? 100,
  });

  if (quotaErr) {
    // Fail CLOSED. If quota accounting is broken we decline rather than hand out
    // unmetered model calls — an outage here is exactly when abuse is cheapest.
    console.error(`[${options.endpoint}] quota check failed`, quotaErr);
    return { ok: false, response: jsonResponse({ error: 'Service temporarily unavailable' }, 503, origin) };
  }

  const verdict = (quota ?? {}) as { allowed?: boolean; reason?: string; retry_after?: number };
  if (!verdict.allowed) {
    const retry = verdict.retry_after ?? 3600;
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: 'Rate limit exceeded. Try again later.',
          reason: verdict.reason ?? 'rate_limited',
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders(origin),
            'Content-Type': 'application/json',
            'Retry-After': String(retry),
          },
        },
      ),
    };
  }

  return { ok: true, userId: userData.user.id, supabase, body, origin };
}

/** Preflight response, shared so no function hand-rolls its own wildcard. */
export function preflight(req: Request): Response {
  return new Response('ok', { headers: corsHeaders(req.headers.get('Origin')) });
}
