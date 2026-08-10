/** Keep PLAN RULES + JSON shape in sync with supabase/functions/generate-workout-plan/prompt.ts */
import type { TrainingStatsSummary } from '@/app/models';

export const PLAN_JSON_SHAPE = `{
  "plan": {
    "title": string,                  // e.g. "5-Day Cut Split" — short, ≤ 28 chars
    "goal_label": string,             // e.g. "Fat loss"
    "sport_label": string,            // e.g. "Gym"
    "days_per_week": number,
    "est_session_minutes": number,    // typical session length across the week
    "rationale_short": string,        // MAX 180 CHARACTERS, 1-2 sentences, the headline reason
    "rationale_full": string,         // the longer explanation, 3-5 sentences
    "accommodations": [               // [] when nothing was worked around
      { "reason": string, "affected_count": number }
    ],
    "days": [
      {
        "day": number,                // 1-based
        "title": string,              // e.g. "Upper Body" — NO "Day 1 —" prefix
        "subtitle": string,           // e.g. "Push focus · chest, shoulders, triceps"
        "focus": "push" | "pull" | "legs" | "full" | "cardio" | "recovery",
        "est_minutes": number,
        "exercises": [
          {
            "name": string,           // the exercise name ONLY, never a sentence
            "sets": number,            // whole number ≥ 1
            "rep_range": string,       // "10-12", "5", "30s"
            "start_load": string,      // "~30 kg / dumbbell", "bodyweight" — "" if unknown
            "note": string,            // "" when there is nothing worth saying
            "note_type": "caution" | "tip" | null
          }
        ]
      }
    ]
  }
}`;

export const PLAN_RULES = [
  'You design a forward-looking, structured multi-day training plan for the athlete.',
  'TARGET FREQUENCY: build EXACTLY the number of training days per week the request asks for — output that many distinct day objects, each with its own focus (a real split, e.g. push/pull/legs/upper/lower or a sensible variant for the count and goal). NEVER collapse the whole week into one day, and never return fewer days than requested.',
  'GOAL FIRST: the plan must serve the user’s goal and sportType from their profile (e.g. cut → include some conditioning; bulk → progressive overload on compounds). Personalise exercise choice and starting loads from their training history when it exists.',
  'COLD START: if history is sparse or empty (few or no sessions / topExercises), still produce a COMPLETE plan for the requested number of days from their goal and sportType using standard, safe, well-known exercises. Do NOT shrink the plan because history is thin — a new user gets a full goal-based program.',
  'EXERCISE SELECTION: prefer movement patterns already in topExercises when present, and freely ADD standard complementary exercises appropriate to the goal/sport to properly fill each day.',
  'NO FABRICATED HISTORY: never state specific PAST weights or reps the user did not log. You may prescribe target sets/reps for the plan; only cite an actual past number if it appears in topExercises.',
  'FOCUS ENUM: every day’s "focus" MUST be exactly one of push / pull / legs / full / cardio / recovery. It drives the colour coding of the screen, so a value outside that list is a bug. Pick the day’s dominant lifting emphasis — a day with conditioning bolted onto a pull session is still "pull".',
  'RATIONALE, TWO LENGTHS: "rationale_short" is the headline shown on the screen and is HARD-CAPPED AT 180 CHARACTERS — one or two sentences, no preamble, no greeting. "rationale_full" carries the detail and only appears when the user taps Read more. Do not repeat the short version verbatim inside the full one.',
  'ACCOMMODATIONS ARE STRUCTURED, NOT PROSE: if recentFlags mention discomfort, do NOT explain it in the rationale. Put one entry per distinct flag in "accommodations" with a short "reason" (e.g. "Left shoulder discomfort") and "affected_count" = how many exercises you swapped or capped for it, and put the specifics on the affected exercises as a note with "note_type": "caution". When nothing was worked around, return an empty array.',
  'NOTES ARE OPTIONAL AND SHORT: only write a "note" when it changes what the athlete does — a cue, a cap, a substitution. One sentence. "note_type" is "caution" for anything protecting a physical flag, "tip" for ordinary coaching, null when there is no note. Never write a note just to fill the field.',
  '"name" is the exercise name alone ("Incline Dumbbell Press") — never a sentence, never with the sets/reps folded in. Cues belong in "note".',
  '"rep_range" is a string so ranges like "8-10" or "30s" are allowed. "sets" is a whole number of at least 1.',
  'Return ONE JSON object only — no markdown, no code fences, no prose outside the JSON.',
].join('\n');

export function buildWorkoutPlanPrompt(
  summary: TrainingStatsSummary,
  targetDaysPerWeek: number,
): { system: string; user: string } {
  const system = [
    'You are VoxFit’s training coach. Calm, direct, encouraging — never hype.',
    '',
    PLAN_RULES,
    '',
    'JSON shape:',
    PLAN_JSON_SHAPE,
  ].join('\n');

  const user = [
    `Design a training plan with EXACTLY ${targetDaysPerWeek} training days per week (${targetDaysPerWeek} day objects, each a distinct focus).`,
    '',
    "Here is the athlete's recent training digest (JSON) — use it to personalise, but build the full plan even if it is sparse:",
    JSON.stringify(summary, null, 2),
  ].join('\n');
  return { system, user };
}
