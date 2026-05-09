import type { DietMealMock, MacroRowMock } from './types';

export const DUMMY_DIET_MACROS: MacroRowMock[] = [
  { label: 'Calories', current: 1280, target: 2200 },
  { label: 'Protein', current: 98, target: 160 },
  { label: 'Carbs', current: 180, target: 250 },
];

export const DUMMY_DIET_MEALS: DietMealMock[] = [
  {
    name: 'Garlic Chicken Rice Bowl',
    prepMinutes: 25,
    calories: 520,
    proteinG: 48,
    carbsG: 42,
    fatG: 12,
    rationale: 'High protein, uses everything you have',
  },
  {
    name: 'Egg Fried Rice',
    prepMinutes: 15,
    calories: 420,
    proteinG: 22,
    carbsG: 58,
    fatG: 14,
    rationale: 'Quick, balanced, good energy source',
  },
  {
    name: 'Broccoli Chicken Stir-fry',
    prepMinutes: 20,
    calories: 380,
    proteinG: 44,
    carbsG: 18,
    fatG: 10,
    rationale: 'High protein, low carb option',
  },
];
