import type { VoiceDoneMock } from './types';

export const DUMMY_VOICE_TRANSCRIPT =
  'Did chest today, 4 sets of bench starting at 60kg going up to 80...';

export const DUMMY_VOICE_RESULT: VoiceDoneMock = {
  sessionTitle: 'Chest Day · Parsed',
  coachSummary:
    'Solid push session — progressive overload on bench shows you’re building strength. Keep shoulders packed on the press and consider a light band pull-apart between sets.',
  exercises: [
    {
      name: 'Bench Press',
      detail: '4 sets · 60–80kg · ~9 reps',
      exerciseType: 'strength',
      isPr: false,
      setRows: [
        {
          index: 1,
          sets: 1,
          weightKg: 60,
          repsDisplay: '8–10',
          durationDisplay: null,
          distanceDisplay: null,
          segmentLabel: null,
          bulletLine: '1 set · 8–10 reps @ 60 kg',
        },
        {
          index: 2,
          sets: 1,
          weightKg: 70,
          repsDisplay: '8–10',
          durationDisplay: null,
          distanceDisplay: null,
          segmentLabel: null,
          bulletLine: '1 set · 8–10 reps @ 70 kg',
        },
        {
          index: 3,
          sets: 1,
          weightKg: 75,
          repsDisplay: '8–10',
          durationDisplay: null,
          distanceDisplay: null,
          segmentLabel: null,
          bulletLine: '1 set · 8–10 reps @ 75 kg',
        },
        {
          index: 4,
          sets: 1,
          weightKg: 80,
          repsDisplay: '8–10',
          durationDisplay: null,
          distanceDisplay: null,
          segmentLabel: null,
          bulletLine: '1 set · 8–10 reps @ 80 kg',
        },
      ],
    },
    {
      name: 'Incline Dumbbell',
      detail: '3 sets · 22kg',
      exerciseType: 'strength',
      isPr: true,
      setRows: [
        {
          index: 1,
          sets: 3,
          weightKg: 22,
          repsDisplay: '10',
          durationDisplay: null,
          distanceDisplay: null,
          segmentLabel: null,
          bulletLine: '3 sets · 10 reps @ 22 kg',
        },
      ],
    },
    {
      name: 'Treadmill Run',
      detail: 'Running 20 min',
      exerciseType: 'cardio',
      isPr: false,
      setRows: [
        {
          index: 1,
          sets: 1,
          weightKg: null,
          repsDisplay: null,
          durationDisplay: '20 min',
          distanceDisplay: null,
          segmentLabel: 'Running',
          bulletLine: 'Running · 20 min',
        },
      ],
    },
  ],
  moodEmoji: '😊',
  moodLabel: 'Positive',
  energyEmoji: '⚡',
  energyLabel: 'High',
  flagsEmoji: '⚠️',
  flagsLabel: 'Shoulder',
};
