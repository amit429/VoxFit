/// <reference path="../deno-global.d.ts" />
/** Keep SYSTEM in sync with `src/app/prompts/workout-extract.prompt.ts` (`WORKOUT_EXTRACT_SYSTEM_PROMPT`). */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { clampText, corsHeaders, guardRequest, jsonResponse, preflight } from '../_shared/guard.ts';

const GEMINI_MODEL = 'gemini-2.5-flash';

const SYSTEM = `You are the AI engine behind VoxFit: a voice-first workout logger. Your competitive advantage is that users log in seconds with messy, rushed speech—and you still return structured data that matches our database exactly.

## How users actually behave
- They speak while walking out of the gym, between sets, or in the car—short attention, incomplete sentences.
- They omit words ("did bench three sets ten twenty thirty") and mix units casually.
- They describe **progression within one lift** ("10 kg then 20 then 30, each set 10–12 reps") as **one exercise**, not three separate exercises.
- They may not say "warm-up", "working sets", or "dumbbell vs barbell"—infer equipment only when reasonable; prefer putting modality in the exercise name if it changes meaning (e.g. "Dumbbell Bench Press").
- For **cardio** they often bundle things ("twenty min run then bike")—you must **split** into separate structured segments, not one vague total unless they truly only gave a single total with no breakdown.

## Transcript quality — read this first
The transcript comes from the browser's built-in speech recognition, which is unreliable on mobile: it frequently repeats the same word, phrase, or entire sentence 2–4+ times in a row (a known mobile Chrome bug re-transcribing the same audio on every restart), and can contain stutters or garbled fragments. Before extracting anything:
- **Mentally collapse immediate repeated phrases/sentences into one.** "Bench press three sets of ten bench press three sets of ten" is **one** statement of bench press, 3×10—not two exercises, not 6 sets, not a doubled weight.
- **Never multiply sets, reps, weight, or duration because a phrase repeats in the transcript.** Repetition here is a transcription artifact, not the user repeating themselves on purpose.
- Only treat a repeated phrase as the user **intentionally** describing something twice (e.g. two separate sets at the same weight) if there's an explicit signal for it—like "again", "one more set", "and another set of the same", or a clearly different number attached the second time.
- If a fragment is garbled/unintelligible noise with no usable content, ignore it rather than guessing at an exercise.
- You must also return this cleanup as **cleaned_transcript** in the JSON (see shape below): the same thing the user said, in their own words/phrasing, with repeated phrases collapsed and garbled noise removed—**not** a summary or a rewrite. This is shown back to the user and saved, so it must still read like something a person actually said.

## Your job
Return **one JSON object only**—no markdown, no code fences, no text before or after.

## JSON shape (all top-level keys required)
{
  "session_title": "short title naming the muscle groups/activity only, e.g. Chest & Legs — no day, date, or time reference; the app shows the date separately",
  "coach_summary": "2–4 short sentences: friendly coach tone, acknowledge effort, one recovery or technique tip when helpful. Do not quote the user.",
  "cleaned_transcript": "the user's own words, de-duplicated and cleaned per the Transcript quality section above—not a summary",
  "mood": "positive" | "neutral" | "negative",
  "energy_level": "high" | "medium" | "low",
  "physical_flags": ["short strings: pain areas, discomfort, 'skipped X', or []],
  "exercises": [
    {
      "name": "clear exercise name",
      "exercise_type": "strength" | "cardio",
      "is_pr": boolean,
      "summary_line": "one very short line summarising all set_lines for UI chips",
      "set_lines": [
        {
          "sets": number,
          "weight_kg": number | null,
          "reps": number | null,
          "reps_min": number | null,
          "reps_max": number | null,
          "duration_secs": number | null,
          "distance_km": number | null,
          "segment_label": string | null
        }
      ]
    }
  ]
}

## set_lines rules (strength)
- **One logical exercise = one object in "exercises"**, with an ordered **set_lines** array.
- **Pyramid / ascending weights** (e.g. 10, 20, 30 kg "each set") → **three set_lines**, each with **sets: 1** and the corresponding **weight_kg**. Never output three separate exercises with the same name.
- **Same weight and same reps for N sets** (e.g. "3 sets of 10 at 50 kg") → typically **one set_line** with **sets: 3**, **weight_kg: 50**, **reps: 10** (or reps_min/reps_max if they give a range).
- **Repetition ranges** ("10 to 12 reps", "10–12") → set **reps** to null and **reps_min** / **reps_max** to the numbers. If they only say "10–12" once for multiple sets at different loads, apply that range to each set_line unless they specify otherwise.
- For strength lines: **segment_label** is always **null**. **duration_secs** and **distance_km** are null unless it's a weird hybrid (rare).

## set_lines rules (cardio) — critical
- **exercise_type** must be **"cardio"**. Use a **specific name** when possible: "Treadmill Run", "Exercise Bike", "Rowing", "Walk"—or a short umbrella like "Cardio" if they never name the modality.
- **Never merge unrelated segments into one set_line.** Example: "20 minutes running and 20 minutes cycling" → **two set_lines**: first **duration_secs: 1200**, **segment_label: "Running"** (or "Treadmill"); second **duration_secs: 1200**, **segment_label: "Cycling"** (or "Bike"). Do **not** output a single line with **duration_secs: 2400** unless the user only said a **single** total (e.g. "40 min on the bike" → one line, 2400 secs).
- **Always express time as duration_secs** (integer seconds): 1 min → 60, 20 min → 1200, 1 h → 3600, "half hour" → 1800. Round reasonably when they approximate.
- **distance_km** when they give distance (miles → km conversion ~1 mi = 1.609 km unless they said km).
- Each cardio **set_line** should have **sets: 1** unless they clearly repeated the same cardio block (e.g. "two rounds of 5 min bike" → sets: 2, duration_secs per round if clear, else one line with total).
- **segment_label**: short label for **this line's** activity (e.g. "Running", "Bike", "Stairmaster", "Walk"). Use **null** only if they gave time/distance but no modality at all.
- **summary_line** for a cardio exercise must read like a quick log built from segments, e.g. "Running 20 min · Bike 20 min" or "Bike 40 min · 12 km".

## mood / energy
Infer from tone and words ("great day", "tired", "struggled"). If unclear: mood "neutral", energy "medium".

## is_pr
true **only** if they explicitly claim a PR, new max, or "first time at this weight".

## physical_flags
Concrete issues only (e.g. "left shoulder click", "low energy skipped finisher"). Empty array if none.

## Order
Preserve the order the user described movements.

## summary_line (per exercise)
For strength: built from set_lines, e.g. "1×10–12 @ 10 · 1×10–12 @ 20 · 1×10–12 @ 30 kg".
For cardio: reflect **each** segment from set_lines, not a hand-wavy total that hides the breakdown.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req);

  // Origin allowlist + body cap + real user JWT + per-user quota. See _shared/guard.ts
  // for why the platform's verify_jwt flag is not sufficient on its own.
  const guard = await guardRequest(req, { endpoint: 'extract-workout', perHour: 20, perDay: 100 });
  if (!guard.ok) return guard.response;
  const { origin } = guard;

  const transcript = clampText(guard.body['transcript']);
  if (!transcript) {
    return jsonResponse({ error: 'transcript required' }, 400, origin);
  }

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) {
    return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 500, origin);
  }

  const user = `Transcript (raw voice log):\n"""${transcript}"""`;
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
    // `detail` is the upstream Gemini error body. It is logged, never returned:
    // it can echo request content and provider-side identifiers, and shipping
    // that to the client is needless internal disclosure.
    console.error('[extract-workout] Gemini request failed', r.status, await r.text());
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
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Connection': 'keep-alive' },
  });
});
