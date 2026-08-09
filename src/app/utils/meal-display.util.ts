import type { DietLogListRow, DietMealTypeDb } from '@/app/models';

/**
 * Fallback emoji per meal type, for rows logged before `diet_logs.emoji`
 * existed and for the ones where the model's glyph failed validation.
 */
const MEAL_TYPE_EMOJI: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍗',
  snack: '🍎',
};

const FALLBACK_EMOJI = '🍽️';

/**
 * Accent per meal type, warm to cool across the day: apricot morning, jade
 * midday, brand evening. Decorative, and the one place colour tracks time of
 * day rather than a role — it makes a list of meals scannable by when.
 */
const MEAL_TYPE_TONE: Record<string, string> = {
  breakfast: 'apricot',
  lunch: 'jade',
  dinner: 'brand',
  snack: 'slate',
};

export function mealTypeEmoji(mealType: DietMealTypeDb | null | undefined): string {
  return MEAL_TYPE_EMOJI[mealType ?? ''] ?? FALLBACK_EMOJI;
}

/**
 * The glyph for a logged meal: the model's own choice where there is one, the
 * meal-type fallback otherwise.
 *
 * Every surface that shows a meal resolves it here, so a history mixing rows
 * from before and after the column was added still reads consistently — and
 * there is one place to change if the fallback ever moves to an icon.
 */
export function mealEmoji(log: Pick<DietLogListRow, 'emoji' | 'meal_type'> | null | undefined): string {
  const own = log?.emoji?.trim();
  return own || mealTypeEmoji(log?.meal_type);
}

export function mealTypeTone(mealType: DietMealTypeDb | null | undefined): string {
  return MEAL_TYPE_TONE[mealType ?? ''] ?? 'brand';
}

export function mealTypeLabel(mealType: DietMealTypeDb | null | undefined): string {
  if (!mealType) return 'Meal';
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}
