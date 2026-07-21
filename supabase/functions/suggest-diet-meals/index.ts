/// <reference path="../deno-global.d.ts" />
/** Keep SYSTEM in sync with `src/app/prompts/diet-meals.prompt.ts` rules + JSON shape. */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const GEMINI_MODEL = 'gemini-2.5-flash';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `You are VoxFit’s fitness-forward cook.
Users speak casually about pantry ingredients and cravings.
Suggest realistic meals they can cook or assemble today.

Return one JSON object only — no markdown, no code fences, no extra text.

JSON shape:
{
  "meals": [
    {
      "name": string,
      "prep_minutes": number (reasonable estimate),
      "calories": number (whole meal approximate),
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "rationale": string (one short line: why it fits ingredients / cravings / goals),
      "recipe_steps": string[] (6–12 clear cooking steps, concise)
    }
  ]
}

Rules:
- Output exactly **5 or 6** meals in \`meals\` (never fewer than 5, never more than 6).
- Macros must be plausible for the meal size (numbers only, grams for macros).
- Respect allergies only if user mentions them; otherwise assume standard omnivore unless they say vegetarian/vegan.
- Steps should be actionable (prep → cook → serve). No ingredient quantities required unless helpful.
- Variety: mix quick vs fuller meals when possible.

Optional user hints may appear after the transcript — treat them as soft guidance only; pantry transcript wins for ingredients.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  let transcript = '';
  let goal: string | undefined;
  let target_calories: number | undefined;
  let target_protein_g: number | undefined;

  try {
    const body = (await req.json()) as {
      transcript?: string;
      goal?: string;
      target_calories?: number;
      target_protein_g?: number;
    };
    transcript = String(body.transcript ?? '').trim();
    goal = body.goal?.trim();
    target_calories = typeof body.target_calories === 'number' ? body.target_calories : undefined;
    target_protein_g = typeof body.target_protein_g === 'number' ? body.target_protein_g : undefined;
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

  let hintBlock = '';
  if (goal || target_calories != null || target_protein_g != null) {
    hintBlock = '\n\nUser targets (soft hints):\n';
    if (goal) hintBlock += `- Goal flavour: ${goal}\n`;
    if (target_calories != null) hintBlock += `- Rough daily calorie target: ~${target_calories} kcal\n`;
    if (target_protein_g != null) hintBlock += `- Rough daily protein target: ~${target_protein_g} g\n`;
  }

  const user = `Pantry / cravings transcript:\n"""${transcript}"""${hintBlock}`;

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
          temperature: 0.35,
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
