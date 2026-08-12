import { parseEatenMealJson } from './gemini-diet-meals.service';

function raw(mealType: unknown): string {
  return JSON.stringify({
    cleaned_transcript: 'eggs and toast',
    meal: {
      name: 'Eggs and toast',
      emoji: '🍳',
      calories: 400,
      protein_g: 20,
      carbs_g: 30,
      fat_g: 15,
      rationale: 'Standard serving assumed.',
      meal_type: mealType,
    },
  });
}

describe('parseEatenMealJson meal_type normalization', () => {
  it('accepts each valid meal_type value', () => {
    expect(parseEatenMealJson(raw('breakfast')).meal.mealType).toBe('breakfast');
    expect(parseEatenMealJson(raw('lunch')).meal.mealType).toBe('lunch');
    expect(parseEatenMealJson(raw('snack')).meal.mealType).toBe('snack');
    expect(parseEatenMealJson(raw('dinner')).meal.mealType).toBe('dinner');
  });

  it('falls back to null for a missing meal_type, so the caller can use inferMealType()', () => {
    expect(parseEatenMealJson(raw(undefined)).meal.mealType).toBeNull();
  });

  it('falls back to null for an invented category rather than trusting it', () => {
    expect(parseEatenMealJson(raw('brunch')).meal.mealType).toBeNull();
  });

  it('falls back to null for a non-string meal_type', () => {
    expect(parseEatenMealJson(raw(3)).meal.mealType).toBeNull();
  });
});
