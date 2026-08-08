import type { DietMealTypeDb } from '@/app/models';

/**
 * Emoji per meal type. `diet_logs` has no emoji column — AI-suggested meals
 * carry one transiently but it is never persisted — so the icon is derived.
 * See Deferred #10.
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

export function mealTypeTone(mealType: DietMealTypeDb | null | undefined): string {
  return MEAL_TYPE_TONE[mealType ?? ''] ?? 'brand';
}

export function mealTypeLabel(mealType: DietMealTypeDb | null | undefined): string {
  if (!mealType) return 'Meal';
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}
