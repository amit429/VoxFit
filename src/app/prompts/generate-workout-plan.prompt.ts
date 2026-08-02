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
  'You design a forward-looking training plan grounded ONLY in the provided stats.',
  'Hallucination guard: you may only reference exercises, weights, and rep numbers that appear in the stats. Never invent specific past numbers the user did not log.',
  'Prefer movement patterns the user already trains (see topExercises). You may add complementary movements, but keep the plan realistic for their sportType and goal.',
  'If a movement pattern appears in recentFlags (discomfort the user mentioned), avoid loading it heavily; offer a gentler alternative and say why in the note.',
  'Match weekly frequency to avgSessionsPerWeek (±1 day). Do not prescribe 6 days to someone training twice a week.',
  'reps is a string so ranges like "8-10" or "30s" are allowed. sets is a whole number.',
  'Return ONE JSON object only — no markdown, no code fences, no prose outside the JSON.',
].join('\n');

export function buildWorkoutPlanPrompt(summary: TrainingStatsSummary): { system: string; user: string } {
  const system = [
    'You are VoxFit’s training coach. Calm, direct, encouraging — never hype.',
    '',
    PLAN_RULES,
    '',
    'JSON shape:',
    PLAN_JSON_SHAPE,
  ].join('\n');

  const user = `Here is the athlete's recent training digest (JSON):\n${JSON.stringify(summary, null, 2)}`;
  return { system, user };
}
