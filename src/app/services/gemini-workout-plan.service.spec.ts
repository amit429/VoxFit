import { parseWorkoutPlanJson } from './gemini-workout-plan.service';
import type { TrainingStatsSummary } from '@/app/models';

const snapshot = {
  goal: 'bulk', sportType: 'gym', targetCalories: 2600, targetProteinG: 170,
  windowWeeks: 8, sessionsInWindow: 12, avgSessionsPerWeek: 1.5, currentStreakDays: 3,
  weeklyVolumeKg: [1000, 1200], prCount: 1, topExercises: [], recentFlags: [],
} as TrainingStatsSummary;

describe('parseWorkoutPlanJson', () => {
  it('parses a well-formed plan and rounds sets to whole numbers', () => {
    const raw = JSON.stringify({
      plan: {
        title: '2-Day Push Split',
        goal_label: 'Build muscle',
        sport_label: 'Gym',
        days_per_week: 2,
        est_session_minutes: 50,
        rationale_short: 'Two focused days to match your current frequency.',
        rationale_full: 'Two focused days to match your current frequency, with the compounds first.',
        accommodations: [],
        days: [
          {
            day: 1,
            title: 'Push',
            subtitle: 'Chest, shoulders, triceps',
            focus: 'push',
            est_minutes: 50,
            exercises: [
              { name: 'Bench Press', sets: 4.6, rep_range: '8-10', start_load: '~60 kg', note: '', note_type: null },
            ],
          },
        ],
      },
    });

    const r = parseWorkoutPlanJson(raw, snapshot);
    expect(r.plan.title).toBe('2-Day Push Split');
    expect(r.aiRationale).toContain('Two focused days');
    expect(r.plan.days.length).toBe(1);
    expect(r.plan.days[0].focus).toBe('push');
    expect(r.plan.days[0].exercises[0].sets).toBe(5); // rounded
    // Hyphens become en-dashes: with mono numerals a hyphen reads as a minus.
    expect(r.plan.days[0].exercises[0].rep_range).toBe('8–10');
    expect(r.plan.days[0].exercises[0].start_load).toBe('~60 kg');
    expect(r.statsSnapshot).toBe(snapshot);
  });

  it('upgrades a legacy-shaped response, inferring focus from the day label', () => {
    const raw = JSON.stringify({
      ai_rationale: 'Built from your last eight weeks.',
      plan: {
        days: [
          {
            day_label: 'Day 1 — Pull',
            focus: 'Back, biceps',
            exercises: [{ name: 'Barbell Row', sets: 4, reps: '8-10', note: 'Keep the shoulder packed.' }],
          },
        ],
      },
    });

    const r = parseWorkoutPlanJson(raw, snapshot);
    const day = r.plan.days[0];
    expect(day.title).toBe('Pull');
    expect(day.subtitle).toBe('Back, biceps');
    expect(day.focus).toBe('pull');
    expect(day.exercises[0].rep_range).toBe('8–10');
    expect(r.plan.rationale_short).toBe('Built from your last eight weeks.');
    // Goal/sport labels reconstructed from the snapshot when the body omits them.
    expect(r.plan.goal_label).toBe('Build muscle');
    expect(r.plan.sport_label).toBe('Gym');
    expect(r.plan.title).toBe('1-Day Build Split');
  });

  it('drops exercises with no usable set count rather than rendering a blank prescription', () => {
    const raw = JSON.stringify({
      plan: {
        days: [
          {
            title: 'Legs',
            focus: 'legs',
            exercises: [
              { name: 'Back Squat', sets: 4, rep_range: '5' },
              { name: 'Leg Press', sets: null, rep_range: '10-12' },
              { name: '', sets: 3, rep_range: '10' },
            ],
          },
        ],
      },
    });

    const names = parseWorkoutPlanJson(raw, snapshot).plan.days[0].exercises.map((e) => e.name);
    expect(names).toEqual(['Back Squat']);
  });

  it('falls back to `full` for a focus outside the enum that nothing else identifies', () => {
    const raw = JSON.stringify({
      plan: { days: [{ title: 'Session A', focus: 'whatever the model felt like', exercises: [] }] },
    });
    expect(parseWorkoutPlanJson(raw, snapshot).plan.days[0].focus).toBe('full');
  });

  it('strips code fences before parsing', () => {
    const raw = '```json\n{"plan":{"rationale_short":"ok","days":[{"title":"A","focus":"full","exercises":[]}]}}\n```';
    const r = parseWorkoutPlanJson(raw, snapshot);
    expect(r.aiRationale).toBe('ok');
    expect(r.plan.days.length).toBe(1);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseWorkoutPlanJson('not json', snapshot)).toThrowError(/valid JSON/);
  });

  it('throws when the plan has no days array', () => {
    expect(() => parseWorkoutPlanJson('{"plan":{}}', snapshot)).toThrowError(/days/);
  });

  it('throws when every day was dropped during normalization', () => {
    expect(() => parseWorkoutPlanJson('{"plan":{"days":[null,"nope"]}}', snapshot)).toThrowError(/no usable days/);
  });
});
