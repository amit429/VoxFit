import type { WeeklyVolumeMock, WorkoutDetailMock, WorkoutSessionListMock } from './types';

export const DUMMY_WORKOUT_SESSIONS: WorkoutSessionListMock[] = [
  {
    label: 'Chest Day',
    dateLabel: 'Today',
    exercises: 4,
    moodEmoji: '😊',
    energyLabel: 'High',
    hasFlag: true,
    hasPr: true,
  },
  {
    label: 'Leg Day',
    dateLabel: 'Yesterday',
    exercises: 5,
    moodEmoji: '😐',
    energyLabel: 'Medium',
    hasFlag: false,
    hasPr: false,
  },
  {
    label: 'Back & Bis',
    dateLabel: 'Mon',
    exercises: 6,
    moodEmoji: '😊',
    energyLabel: 'High',
    hasFlag: false,
    hasPr: true,
  },
  {
    label: 'Rest Day',
    dateLabel: 'Sun',
    exercises: 0,
    moodEmoji: '😴',
    energyLabel: 'Low',
    hasFlag: false,
    hasPr: false,
  },
];

export const DUMMY_WORKOUT_DETAIL: WorkoutDetailMock = {
  title: 'Chest Day',
  dateLabel: 'Today',
  moodEmoji: '😊',
  moodLabel: 'Positive',
  energyLabel: '⚡ High',
  volumeLabel: '8,240kg',
  coachNote:
    'Strong chest session with excellent volume progression on bench. Monitor shoulder — drop incline weight 10% next session and focus on form.',
  exercises: [
    { name: 'Bench Press', detail: '4×9 · 72.5kg avg', pr: true },
    { name: 'Incline Dumbbell', detail: '3×10 · 22kg', pr: false },
    { name: 'Cable Flyes', detail: '3×12 · 15kg', pr: false },
    { name: 'Treadmill', detail: '20 min · ~3km', pr: false },
  ],
  flagsTitle: 'Physical Flags',
  flagsBody: 'Right shoulder discomfort noted during incline press — monitor on next session.',
};

export const DUMMY_WEEKLY_VOLUME: WeeklyVolumeMock = {
  label: 'Weekly Volume (kg)',
  values: [18, 32, 24, 44, 38, 52, 48],
  dayLabels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
};
