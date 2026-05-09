import type { VoiceDoneMock } from './types';

export const DUMMY_VOICE_TRANSCRIPT =
  'Did chest today, 4 sets of bench starting at 60kg going up to 80...';

export const DUMMY_VOICE_RESULT: VoiceDoneMock = {
  sessionTitle: 'Chest Day · Parsed',
  exercises: [
    { name: 'Bench Press', detail: '4 sets · 60–80kg · ~9 reps' },
    { name: 'Incline Dumbbell', detail: '3 sets · 22kg' },
    { name: 'Treadmill', detail: '20 min cardio' },
  ],
  moodEmoji: '😊',
  moodLabel: 'Positive',
  energyEmoji: '⚡',
  energyLabel: 'High',
  flagsEmoji: '⚠️',
  flagsLabel: 'Shoulder',
};
