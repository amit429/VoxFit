/** Keep PLAN RULES + JSON shape in sync with supabase/functions/generate-workout-plan/prompt.ts */
import type { TrainingStatsSummary } from '@/app/models';

export const PLAN_JSON_SHAPE = `{
  "ai_rationale": string  // 1-3 calm sentences, coach voice, why this plan fits their stats,
  "plan": {
    "days": [
      {
        "day_label": string,      // e.g. "Day 1 — Push"
        "focus": string,          // e.g. "Chest, shoulders, triceps"
        "exercises": [
          { "name": string, "sets": number, "reps": string, "note": string }
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
  'If a movement pattern appears in recentFlags (discomfort the user mentioned), avoid loading it heavily; offer a gentler alternative and say why in the note.',
  'reps is a string so ranges like "8-10" or "30s" are allowed. sets is a whole number.',
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
