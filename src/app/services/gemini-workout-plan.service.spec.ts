import { parseWorkoutPlanJson } from './gemini-workout-plan.service';
import type { TrainingStatsSummary } from '@/app/models';

const snapshot = {
  goal: 'bulk', sportType: 'gym', targetCalories: 2600, targetProteinG: 170,
  windowWeeks: 8, sessionsInWindow: 12, avgSessionsPerWeek: 1.5, currentStreakDays: 3,
  weeklyVolumeKg: [1000, 1200], prCount: 1, topExercises: [], recentFlags: [],
} as TrainingStatsSummary;

describe('parseWorkoutPlanJson', () => {
  it('parses a well-formed plan and clamps sets to whole numbers', () => {
    const raw = JSON.stringify({
      ai_rationale: 'Two focused days to match your current frequency.',
      plan: { days: [
        { day_label: 'Day 1 — Push', focus: 'Chest', exercises: [
          { name: 'Bench Press', sets: 4.6, reps: '8-10', note: '' },
        ] },
      ] },
    });

    const r = parseWorkoutPlanJson(raw, snapshot);
    expect(r.aiRationale).toContain('Two focused days');
    expect(r.plan.days.length).toBe(1);
    expect(r.plan.days[0].exercises[0].sets).toBe(5); // rounded
    expect(r.plan.days[0].exercises[0].reps).toBe('8-10');
    expect(r.statsSnapshot).toBe(snapshot);
  });

  it('strips code fences before parsing', () => {
    const raw = '```json\n{"ai_rationale":"ok","plan":{"days":[]}}\n```';
    const r = parseWorkoutPlanJson(raw, snapshot);
    expect(r.aiRationale).toBe('ok');
    expect(r.plan.days).toEqual([]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseWorkoutPlanJson('not json', snapshot)).toThrowError(/valid JSON/);
  });

  it('throws when the plan has no days array', () => {
    expect(() => parseWorkoutPlanJson('{"ai_rationale":"x"}', snapshot)).toThrowError(/days/);
  });
});
