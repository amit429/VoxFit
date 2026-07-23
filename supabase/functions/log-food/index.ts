/// <reference path="../deno-global.d.ts" />
/** Keep SYSTEM in sync with `src/app/prompts/food-log.prompt.ts` rules + JSON shape. */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const GEMINI_MODEL = 'gemini-2.5-flash';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    "calories": number (whole aggregate meal, best estimate),
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "rationale": string (one short line — portion assumption and/or estimate basis)
  }
}

Rules:
- Exactly one object in "meal" — never an array, never multiple meals.
- Macros must be plausible for typical nutrition data for the foods described.
- No recipe_steps, no prep_minutes fields — this food is already eaten, not being cooked.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  let transcript = '';
  try {
    const body = (await req.json()) as { transcript?: string };
    transcript = String(body.transcript ?? '').trim();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!transcript) {
    return new Response(JSON.stringify({ error: 'transcript required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const user = `Transcript of what the user ate:\n"""${transcript}"""`;

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
    const detail = await r.text();
    return new Response(JSON.stringify({ error: 'Gemini request failed', detail }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const data = (await r.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const part = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!part?.trim()) {
    return new Response(JSON.stringify({ error: 'Empty model response' }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(part.trim(), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', Connection: 'keep-alive' },
  });
});
