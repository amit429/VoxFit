/// <reference path="../deno-global.d.ts" />
/**
 * Classifies exercise names into muscle groups and caches the answer globally.
 *
 * Invoked fire-and-forget by the `exercises_logged` insert trigger (see
 * migration 0007), so nothing here is on a user's critical path — a workout is
 * already saved by the time this runs. Rows sit with a null muscle until this
 * lands, and the Progress screen reports that as pending rather than guessing.
 *
 * `exercise_muscle_map` is global, not per user: classifying "Pec Fly" once
 * serves every user forever. That is what keeps the AI cost at roughly one call
 * per novel exercise name across the whole product.
 *
 * verify_jwt is off because the caller is a Postgres trigger, not a signed-in
 * user; the handler checks the service-role bearer itself instead.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GEMINI_MODEL = 'gemini-2.5-flash';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * The only permitted answers. Must stay identical to the `muscle_group` domain
 * in migration 0007 — the database rejects anything else, so a drift here shows
 * up as a failed upsert rather than bad data.
 */
const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'glutes',
  'shoulders',
  'arms',
  'core',
  'cardio',
  'other',
] as const;

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** How many names one invocation will classify. A batch is one session's worth. */
const MAX_NAMES = 40;

const SYSTEM = `You classify strength-training exercise names into muscle groups for a workout logger.

Return ONE JSON object only — no markdown, no code fences, no prose.

Shape:
{
  "classifications": [
    { "name": "<the exact input name>", "primary_muscle": "<group>", "secondary_muscle": "<group>" | null }
  ]
}

Rules:
- "primary_muscle" and "secondary_muscle" MUST each be one of exactly:
  chest, back, legs, glutes, shoulders, arms, core, cardio, other
- "primary_muscle" is the muscle group doing most of the work. "secondary_muscle" is a
  meaningful assisting group, or null when there isn't a clear one. Never repeat the primary
  as the secondary.
- "legs" covers quads, hamstrings and calves. "glutes" is separate because lifters
  program it separately. "arms" covers biceps, triceps and forearms.
- Use "cardio" for conditioning work with no meaningful tonnage (running, cycling, rowing).
- Use "other" ONLY when the name is genuinely unrecognisable as an exercise — a typo, a
  fragment, or noise. Prefer a real group whenever the name is interpretable.
- Return exactly one entry per input name, echoing the name back verbatim so it can be
  matched up. Do not add, merge, split or rename entries.

Names are voice-transcribed, so expect casual phrasing, plurals and minor mistakes
("Flyes", "Chest Flies", "Decline Crunches"). Interpret them as a coach would.`;

interface Classification {
  readonly name: string;
  readonly primary_muscle: MuscleGroup;
  readonly secondary_muscle: MuscleGroup | null;
}

function isMuscleGroup(value: unknown): value is MuscleGroup {
  return typeof value === 'string' && (MUSCLE_GROUPS as readonly string[]).includes(value);
}

/**
 * Coerce the model's output. Every field is validated against the enum with
 * `other` as the fallback — the model's string is never trusted, because a
 * hallucinated group would be rejected by the domain constraint and take the
 * whole batch's upsert down with it.
 */
function parseClassifications(raw: string): Classification[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const list = (parsed as { classifications?: unknown })?.classifications;
  if (!Array.isArray(list)) return [];

  const out: Classification[] = [];
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const name = typeof row['name'] === 'string' ? row['name'].trim() : '';
    if (!name) continue;

    const primary = isMuscleGroup(row['primary_muscle']) ? row['primary_muscle'] : 'other';
    const secondaryRaw = row['secondary_muscle'];
    const secondary = isMuscleGroup(secondaryRaw) ? secondaryRaw : null;

    out.push({
      name,
      primary_muscle: primary,
      /* A secondary equal to the primary carries no information. */
      secondary_muscle: secondary === primary ? null : secondary,
    });
  }
  return out;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Push the newly-cached muscles onto every unclassified logged row with these
 * names — across all users, since the dictionary is global. Uses the same
 * normalize-then-join the trigger does, so a row filled here is identical to
 * one written at insert time.
 */
async function backfillLoggedRows(
  supabase: ReturnType<typeof createClient>,
  names: string[],
): Promise<number> {
  const { data, error } = await supabase.rpc('backfill_exercise_muscles', { p_names: names });
  if (error) {
    console.error('[classify] backfill', error);
    return 0;
  }
  return typeof data === 'number' ? data : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405);
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!serviceKey || !supabaseUrl) {
    return json({ error: 'Supabase env not configured' }, 500);
  }
  if (!geminiKey) {
    return json({ error: 'GEMINI_API_KEY not configured' }, 500);
  }

  /*
   * The trigger authenticates with the service key. Compare against it directly
   * rather than verifying a user JWT: this endpoint writes a shared dictionary,
   * so it is server-to-server only.
   */
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${serviceKey}`) {
    return json({ error: 'forbidden' }, 403);
  }

  let names: string[];
  try {
    const body = (await req.json()) as { exercise_names?: unknown };
    names = Array.isArray(body.exercise_names)
      ? [...new Set(body.exercise_names.filter((n): n is string => typeof n === 'string' && n.trim() !== ''))]
          .map((n) => n.trim())
          .slice(0, MAX_NAMES)
      : [];
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  if (names.length === 0) {
    return json({ classified: 0, skipped: 'no names' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  /*
   * Re-check the cache before spending a call. Between the trigger firing and
   * this running, a concurrent invocation may already have classified some of
   * these — two sessions logged back to back would otherwise both pay.
   */
  const { data: keyRows, error: keyErr } = await supabase.rpc('normalize_exercise_keys', {
    p_names: names,
  });
  if (keyErr) {
    console.error('[classify] normalize keys', keyErr);
    return json({ error: keyErr.message }, 500);
  }

  const keyByName = new Map<string, string>();
  for (const row of (keyRows ?? []) as { name: string; exercise_key: string }[]) {
    if (row.exercise_key) keyByName.set(row.name, row.exercise_key);
  }

  const candidateKeys = [...new Set(keyByName.values())];
  const { data: existing } = await supabase
    .from('exercise_muscle_map')
    .select('exercise_key')
    .in('exercise_key', candidateKeys);

  const known = new Set((existing ?? []).map((r) => r.exercise_key as string));
  const toClassify = names.filter((n) => {
    const key = keyByName.get(n);
    return key !== undefined && !known.has(key);
  });

  if (toClassify.length === 0) {
    /* Someone else got there first — still backfill, then stop. */
    const filled = await backfillLoggedRows(supabase, names);
    return json({ classified: 0, backfilled: filled, note: 'already cached' });
  }

  const prompt = `Classify these exercise names:\n${toClassify.map((n) => `- ${n}`).join('\n')}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error('[classify] gemini failed', detail);
    return json({ error: 'Gemini request failed', detail }, 502);
  }

  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    return json({ error: 'Empty model response' }, 502);
  }

  const classifications = parseClassifications(text);
  if (classifications.length === 0) {
    return json({ error: 'No usable classifications' }, 502);
  }

  /*
   * Only accept names we actually asked about. The model echoing back something
   * invented would otherwise pollute a table every user reads.
   */
  const requested = new Set(toClassify.map((n) => n.toLowerCase()));
  const rows: {
    exercise_key: string;
    primary_muscle: MuscleGroup;
    secondary_muscle: MuscleGroup | null;
    source: 'ai';
  }[] = [];

  for (const c of classifications) {
    if (!requested.has(c.name.toLowerCase())) continue;
    const matched = toClassify.find((n) => n.toLowerCase() === c.name.toLowerCase()) ?? c.name;
    const key = keyByName.get(matched);
    if (!key) continue;
    rows.push({
      exercise_key: key,
      primary_muscle: c.primary_muscle,
      secondary_muscle: c.secondary_muscle,
      source: 'ai',
    });
  }

  if (rows.length === 0) {
    return json({ error: 'Model returned no requested names' }, 502);
  }

  const { error: upsertErr } = await supabase
    .from('exercise_muscle_map')
    .upsert(rows, { onConflict: 'exercise_key', ignoreDuplicates: true });

  if (upsertErr) {
    console.error('[classify] upsert map', upsertErr);
    return json({ error: upsertErr.message }, 500);
  }

  const backfilled = await backfillLoggedRows(supabase, names);
  return json({ classified: rows.length, backfilled });
});
