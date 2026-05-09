import type { WeeklyVolumeMock, WorkoutDetailMock, WorkoutSessionListMock } from './types';

export const DUMMY_WORKOUT_SESSIONS: WorkoutSessionListMock[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    label: 'Chest Day',
    dateLabel: 'Today',
    dateKey: '',
    exercises: 4,
    moodEmoji: '😊',
    energyLabel: 'High',
    hasFlag: true,
    hasPr: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    label: 'Leg Day',
    dateLabel: 'Yesterday',
    dateKey: '',
    exercises: 5,
    moodEmoji: '😐',
    energyLabel: 'Medium',
    hasFlag: false,
    hasPr: false,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    label: 'Back & Bis',
    dateLabel: 'Mon',
    dateKey: '',
    exercises: 6,
    moodEmoji: '😊',
    energyLabel: 'High',
    hasFlag: false,
    hasPr: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    label: 'Rest Day',
    dateLabel: 'Sun',
    dateKey: '',
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
