/** Keep in sync with `supabase/functions/suggest-diet-meals/index.ts` SYSTEM block. */

import type { DietMealsPromptContext } from '@/app/models';

export function buildDietMealsPrompt(transcript: string, ctx?: DietMealsPromptContext): { system: string; user: string } {
  const lines: string[] = [
    'You are VoxFit’s fitness-forward cook.',
    'Users speak casually about pantry ingredients and cravings.',
    'Suggest realistic meals they can cook or assemble today.',
    '',
    'Transcript quality — read this first: the transcript comes from the browser’s built-in speech',
    'recognition, which is unreliable on mobile and frequently repeats the same word or phrase',
    '2–4+ times in a row (a known mobile Chrome bug), or contains garbled fragments. Mentally',
    'collapse repeated phrases into one before reading ingredients/cravings — "chicken chicken',
    'chicken" means the pantry has chicken once, not three times and not a stronger craving signal.',
    'Ignore unintelligible fragments rather than guessing an ingredient from noise. You must also',
    'return this cleanup as "cleaned_transcript" in the JSON: the same thing the user said, in',
    'their own words/phrasing, with repeated phrases collapsed and garbled noise removed — not a',
    'summary or a rewrite. This is saved and may be shown back to the user.',
    '',
    'Return one JSON object only — no markdown, no code fences, no extra text.',
    '',
    'JSON shape:',
    '{',
    '  "cleaned_transcript": "the user\'s own words, de-duplicated and cleaned per above — not a summary",',
    '  "meals": [',
    '    {',
    '      "name": string,',
    '      "prep_minutes": number (reasonable estimate),',
    '      "calories": number (whole meal approximate),',
    '      "protein_g": number,',
    '      "carbs_g": number,',
    '      "fat_g": number,',
    '      "rationale": string (one short line: why it fits ingredients / cravings / goals),',
    '      "recipe_steps": string[] (6–12 clear cooking steps, concise)',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Output exactly **5 or 6** meals in `meals` (never fewer than 5, never more than 6).',
    '- Macros must be plausible for the meal size (numbers only, grams for macros).',
    '- Respect allergies only if user mentions them; otherwise assume standard omnivore unless they say vegetarian/vegan.',
    '- Steps should be actionable (prep → cook → serve). No ingredient quantities required unless helpful.',
    '- Variety: mix quick vs fuller meals when possible.',
  ];

  if (ctx?.goal || ctx?.targetCalories || ctx?.targetProteinG) {
    lines.push('', 'User targets (soft hints — still honour pantry transcript):');
    if (ctx.goal) lines.push(`- Goal flavour: ${ctx.goal}`);
    if (ctx.targetCalories != null) lines.push(`- Rough daily calorie target: ~${ctx.targetCalories} kcal`);
    if (ctx.targetProteinG != null) lines.push(`- Rough daily protein target: ~${ctx.targetProteinG} g`);
  }

  const system = lines.join('\n');
  const user = `Pantry / cravings transcript:\n"""${transcript.trim()}"""`;

  return { system, user };
}
