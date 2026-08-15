/// <reference path="../deno-global.d.ts" />
/**
 * Speech-to-text for both voice-logging flows.
 *
 * This replaced live browser/OS speech recognition (Web Speech API on the web,
 * `@capacitor-community/speech-recognition` on Android). Both are session-based:
 * the recogniser ends itself after a short silence, and every restart is a fresh
 * session that can fail — leaving the app recording nothing while the UI still
 * says "listening". Recording a bounded clip and transcribing it in one call
 * has no session to time out, so that whole class of bug does not exist here.
 *
 * Unlike the Gemini functions there is deliberately no client-direct twin and no
 * `environment.useGeminiEdgeFunction` gate: a Groq key cannot ship in the bundle
 * (`scripts/scan-bundle-secrets.js` would flag it, correctly), so this path is
 * the only path.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders, guardBinaryRequest, jsonResponse, preflight } from '../_shared/guard.ts';

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * `whisper-large-v3-turbo`: ~12% WER at $0.04/audio-hour, against 10.3% at
 * $0.111 for the full `whisper-large-v3`. The gap is noise next to what Gemini
 * then does with the text — it already reconciles messy phrasing — so the
 * cheaper, faster model is the right trade for a voice logger.
 */
const GROQ_MODEL = 'whisper-large-v3-turbo';

/**
 * Whisper accepts a short biasing prompt (hard limit 224 tokens) that steers
 * spelling and vocabulary. Gym speech is exactly the case it helps with: without
 * it, "lat pulldown" comes back as "lap pull down" and "RPE" as "R.P.". This is
 * the cheapest accuracy win available on this path and has no equivalent in the
 * recogniser it replaced.
 *
 * Keep it a vocabulary list in natural phrasing, NOT an instruction — Whisper
 * conditions on it as if it were preceding transcript text, so imperatives
 * ("transcribe accurately") do nothing and can leak into the output.
 */
const VOCABULARY_PROMPT =
  'Gym workout and meal log. Sets, reps, kg, lbs, RPE, PR, superset, dropset, AMRAP, warm-up, ' +
  'bench press, incline dumbbell press, overhead press, deadlift, Romanian deadlift, back squat, ' +
  'front squat, leg press, lat pulldown, barbell row, seated cable row, pull-ups, chin-ups, dips, ' +
  'bicep curls, hammer curls, tricep pushdown, skull crushers, lateral raises, face pulls, ' +
  'leg extensions, hamstring curls, calf raises, hip thrust, plank, treadmill, incline walk, ' +
  'stairmaster, rowing machine, elliptical, kettlebell swings. Calories, protein, carbs, fats, grams, ' +
  'oats, whey, paneer, dal, roti, chapati, curd, chicken breast, eggs, banana, rice, salad.';

/** Groq's own limit is 25 MB (free tier); the guard stops us long before this. */
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/**
 * Whisper detects format from the filename extension, so a mislabelled part is
 * rejected upstream. The recorder produces `audio/mp4` (AAC in MPEG-4) on
 * Android and `audio/webm;codecs=opus` or `audio/ogg;codecs=opus` on the web;
 * everything else here is defensive.
 */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mpga': 'mpga',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
};

/** Strips codec parameters (`audio/webm;codecs=opus`) before the table lookup. */
function extensionFor(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  return EXTENSION_BY_TYPE[base] ?? 'webm';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req);

  // Origin allowlist + 12 MB body cap + real user JWT + per-user quota.
  // `perDay` matches the Gemini functions on purpose: the quota RPC counts the
  // daily budget across *all* endpoints (only the hourly bucket is per-endpoint),
  // so a higher number here would not buy extra transcriptions — it would just
  // disagree with the ceiling every other function enforces. Note one voice log
  // now spends two daily events: this, then extract-workout / suggest-diet-meals.
  const guard = await guardBinaryRequest(req, {
    endpoint: 'transcribe-audio',
    perHour: 30,
    perDay: 100,
    maxBytes: MAX_AUDIO_BYTES,
  });
  if (!guard.ok) return guard.response;
  const { origin, formData } = guard;

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return jsonResponse({ error: 'audio file required' }, 400, origin);
  }

  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) {
    return jsonResponse({ error: 'GROQ_API_KEY not configured' }, 500, origin);
  }

  const upstream = new FormData();
  upstream.append('file', file, `audio.${extensionFor(file.type)}`);
  upstream.append('model', GROQ_MODEL);
  upstream.append('response_format', 'json');
  upstream.append('language', 'en');
  upstream.append('prompt', VOCABULARY_PROMPT);
  // Greedy decoding. Whisper's fallback sampling is where its hallucination
  // failure mode lives (repeating a phrase to fill silence), and a workout log
  // is short, plain speech that gains nothing from creative decoding.
  upstream.append('temperature', '0');

  const r = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: upstream,
  });

  if (!r.ok) {
    // Logged, never returned: the upstream body can echo request content and
    // provider-side identifiers. Same rule as the Gemini functions.
    console.error('[transcribe-audio] Groq request failed', r.status, await r.text());
    const status = r.status === 429 ? 429 : 502;
    return jsonResponse({ error: 'Transcription failed' }, status, origin);
  }

  const data = (await r.json()) as { text?: string };
  const transcript = (data.text ?? '').trim();
  if (!transcript) {
    // A clip of pure silence transcribes to an empty string rather than failing.
    // That is a user-facing "say something" case, not a server error.
    return jsonResponse({ error: 'No speech detected' }, 422, origin);
  }

  return new Response(JSON.stringify({ transcript }), {
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
});
