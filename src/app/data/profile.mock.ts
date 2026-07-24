import type { ProfileGoalRowMock } from '@/app/models';

/** 1..31 — days with a workout logged (for heatmap) */
export const DUMMY_PROFILE_WORKOUT_DAYS = new Set([
  1, 2, 4, 5, 7, 8, 9, 11, 12, 14, 15, 16, 18, 19, 21, 22,
]);

export const DUMMY_PROFILE_DISPLAY = {
  name: 'Arjun Sharma',
  email: 'arjun@gmail.com',
  initial: 'A',
  sportChip: 'Gym-goer',
  goalChip: 'Bulking',
  calendarTitle: 'July 2025',
};

export const DUMMY_PROFILE_GOALS: ProfileGoalRowMock[] = [
  { label: 'Daily Calories', value: '2,200 kcal' },
  { label: 'Protein Target', value: '160g' },
  { label: 'Workout Frequency', value: '5× / week' },
  { label: 'Primary Goal', value: 'Bulk / Gain' },
];
