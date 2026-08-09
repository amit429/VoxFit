import type { DietLogListRow } from '@/app/models';
import { mealEmoji, mealTypeEmoji } from '@/app/utils/meal-display.util';

type MealGlyphSource = Pick<DietLogListRow, 'emoji' | 'meal_type'>;

describe('mealEmoji', () => {
  it('prefers the glyph the model chose for the dish', () => {
    const log: MealGlyphSource = { emoji: '🍜', meal_type: 'lunch' };

    expect(mealEmoji(log)).toBe('🍜');
    /* Not the meal-type fallback, which would make every lunch identical. */
    expect(mealEmoji(log)).not.toBe(mealTypeEmoji('lunch'));
  });

  /** Rows logged before `diet_logs.emoji` existed. */
  it('falls back to the meal type when there is no stored glyph', () => {
    expect(mealEmoji({ emoji: null, meal_type: 'breakfast' })).toBe(mealTypeEmoji('breakfast'));
  });

  it('treats a blank stored glyph as absent', () => {
    expect(mealEmoji({ emoji: '   ', meal_type: 'dinner' })).toBe(mealTypeEmoji('dinner'));
  });

  it('falls back to a place setting when neither is known', () => {
    expect(mealEmoji({ emoji: null, meal_type: null })).toBe('🍽️');
    expect(mealEmoji(null)).toBe('🍽️');
  });
});
