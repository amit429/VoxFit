/// <reference path="../deno-global.d.ts" />
/** Keep SYSTEM in sync with `src/app/prompts/food-log.prompt.ts` rules + JSON shape. */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { clampText, corsHeaders, guardRequest, jsonResponse, preflight } from '../_shared/guard.ts';

const GEMINI_MODEL = 'gemini-2.5-flash';

const SYSTEM = `You are VoxFit’s nutrition estimator.
The user is describing food they have ALREADY EATEN — not something to cook. Do not suggest
recipes, prep steps, or alternatives. Your only job is to turn what they said into one
nutrition-estimated log entry.

Transcript quality — read this first: the transcript comes from the browser’s built-in speech
recognition, which is unreliable on mobile and frequently repeats the same word or phrase
2–4+ times in a row (a known mobile Chrome bug), or contains garbled fragments. Mentally
collapse repeated phrases into one before reading what was eaten — "chicken chicken chicken"
means the user ate chicken once, not three portions. Ignore unintelligible fragments rather
than guessing a food from noise. You must also return this cleanup as "cleaned_transcript" in
the JSON: the same thing the user said, in their own words/phrasing, with repeated phrases
collapsed and garbled noise removed — not a summary or a rewrite.

Combine everything the user mentions eating (even multiple distinct foods/items in one
sitting) into a SINGLE aggregate meal entry — never return more than one item.

Naming: if the user gave the meal/dish a name, use their own wording (cleaned up, not
invented). Otherwise construct a short, concrete descriptive name from the foods mentioned
(e.g. "Grilled chicken, rice & broccoli"), not a generic label like "Meal".

Meal type classification — "meal_type" in the JSON below:
1. EXPLICIT MENTION WINS. If the transcript names the meal directly — "for breakfast…",
   "logging my lunch", "had this as a snack", "that was dinner" — use exactly that, even if
   it contradicts the local time below. This is the user telling you, not you guessing.
2. Otherwise, classify from the local time the meal was logged, given below as HH:MM in
   24-hour time. Use these bands, and pick whichever one the time falls in:
   - 06:00–10:59  -> "breakfast"
   - 11:00–14:59  -> "lunch"
   - 15:00–16:59  -> "snack"
   - 17:00–21:59  -> "dinner"
   - anything else (22:00–05:59, late night / very early morning) -> "snack"
Never leave "meal_type" out or invent a fifth category — it must be exactly one of
"breakfast", "lunch", "snack", "dinner".

Portion sizes: the user often won’t state exact quantities. When a portion is unstated,
assume a standard/average adult serving size for that food (use your best typical-nutrition-
data judgment) rather than asking or guessing wildly — and say so plainly in "rationale" as a
short one-line note, e.g. "Assumed a standard ~1 cup serving of rice since portion wasn't
stated." If the user did state a quantity, use it and let "rationale" simply confirm the basis
for the estimate. This transparency matters — the user is trusting an estimate, not a scale.

Return one JSON object only — no markdown, no code fences, no text before or after.

JSON shape:
{
  "cleaned_transcript": "the user's own words, de-duplicated and cleaned per above — not a summary",
  "meal": {
    "name": string,
    "emoji": string (ONE emoji that best pictures what was eaten — a food or drink glyph, as
      specific as you can get: 🍜 for a noodle soup, 🌯 for a wrap, 🥣 for oats. For a mixed
      plate, pick the glyph for whatever dominated it. Exactly one emoji, no text),
    "calories": number (whole aggregate meal, best estimate),
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "rationale": string (one short line — portion assumption and/or estimate basis),
    "meal_type": "breakfast" | "lunch" | "snack" | "dinner" (see classification rules above)
  }
}

Rules:
- Exactly one object in "meal" — never an array, never multiple meals.
- Macros must be plausible for typical nutrition data for the foods described.
- No recipe_steps, no prep_minutes fields — this food is already eaten, not being cooked.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req);

  // Origin allowlist + body cap + real user JWT + per-user quota. See _shared/guard.ts
  // for why the platform's verify_jwt flag is not sufficient on its own.
  const guard = await guardRequest(req, { endpoint: 'log-food', perHour: 20, perDay: 100 });
  if (!guard.ok) return guard.response;
  const { origin } = guard;

  const transcript = clampText(guard.body['transcript']);
  // Short, format-validated below — a small cap is plenty and keeps it out of the token budget.
  const localTime = clampText(guard.body['local_time'], 16);

  if (!transcript) {
    return jsonResponse({ error: 'transcript required' }, 400, origin);
  }

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) {
    return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 500, origin);
  }

  const timeLine =
    /^\d{2}:\d{2}$/.test(localTime) ?
      `Logged at local time: ${localTime} (24-hour HH:MM).\n`
    : '';
  const user = `${timeLine}Transcript of what the user ate:\n"""${transcript}"""`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.25,
        },
      }),
    },
  );

  if (!r.ok) {
    // Logged, not returned — the upstream body can echo request content.
    console.error('[log-food] Gemini request failed', r.status, await r.text());
    return jsonResponse({ error: 'Gemini request failed' }, 502, origin);
  }

  const data = (await r.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const part = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!part?.trim()) {
    return jsonResponse({ error: 'Empty model response' }, 502, origin);
  }

  return new Response(part.trim(), {
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', Connection: 'keep-alive' },
  });
});
