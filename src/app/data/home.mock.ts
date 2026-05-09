import type { HomeMacrosMock, HomeStreakMock, HomeWorkoutCardMock } from './types';

export const DUMMY_HOME_STREAK: HomeStreakMock = {
  days: 7,
  weekDots: [
    { label: 'M', completed: true },
    { label: 'T', completed: true },
    { label: 'W', completed: true },
    { label: 'T', completed: true },
    { label: 'F', completed: true },
    { label: 'S', completed: false },
    { label: 'S', completed: false },
  ],
};

export const DUMMY_HOME_WORKOUT: HomeWorkoutCardMock = {
  title: "Today's Workout",
  subtitle: 'Chest Day · 4 exercises · 52 min',
  statusLabel: 'Logged',
  statusTone: 'success',
  exerciseChips: ['Bench Press', 'Incline DB', 'Cables', 'Cardio'],
  coachTitle: 'Coach Note',
  coachNote: 'Strong chest session. Monitor shoulder discomfort on next session.',
};

export const DUMMY_HOME_MACROS: HomeMacrosMock = {
  rows: [
    { label: 'Protein', current: 98, target: 160 },
    { label: 'Carbs', current: 180, target: 250 },
    { label: 'Fat', current: 42, target: 65 },
  ],
  hint: "62g protein left — you're under target",
};
