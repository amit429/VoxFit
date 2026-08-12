import { buildTrainingStatsSummary } from './training-stats.util';
import type { UserProfile, WorkoutSessionRow } from '@/app/models';

function session(date: string, exercises: WorkoutSessionRow['exercises_logged'], flags: string[] = []): WorkoutSessionRow {
  return {
    id: `s-${date}`, user_id: 'u1', date, session_label: 'W', ai_summary: null,
    mood: null, energy_level: null, physical_flags: flags, created_at: `${date}T10:00:00Z`,
    exercises_logged: exercises,
  } as WorkoutSessionRow;
}

const profile = { goal: 'bulk', sport_type: 'gym', target_calories: 2600, target_protein_g: 170 } as UserProfile;

describe('buildTrainingStatsSummary', () => {
  it('counts sessions, PRs, and dedupes flags within the window', () => {
    const sessions = [
      session('2026-07-28', [
        { id: 'e1', session_id: 's1', exercise_name: 'Bench Press', exercise_type: 'strength', sets: 4, reps: 8, weight_kg: 60, is_pr: true, pr_source: 'declared', duration_secs: null, distance_km: null, summary_line: null, set_lines: [] },
      ], ['knee felt off']),
      session('2026-07-30', [
        { id: 'e2', session_id: 's2', exercise_name: 'Bench Press', exercise_type: 'strength', sets: 4, reps: 8, weight_kg: 62.5, is_pr: false, pr_source: null, duration_secs: null, distance_km: null, summary_line: null, set_lines: [] },
      ], ['knee felt off', 'left wrist tight']),
    ];

    const s = buildTrainingStatsSummary({ sessions, profile, windowWeeks: 8, topN: 5 });

    expect(s.sessionsInWindow).toBe(2);
    expect(s.prCount).toBe(1);
    expect(s.goal).toBe('bulk');
    expect(s.targetCalories).toBe(2600);
    expect(s.recentFlags.sort()).toEqual(['knee felt off', 'left wrist tight']);
  });

  it('reports the most-recent weight/reps for a top exercise', () => {
    const sessions = [
      session('2026-07-28', [
        { id: 'e1', session_id: 's1', exercise_name: 'Squat', exercise_type: 'strength', sets: 3, reps: 5, weight_kg: 80, is_pr: false, pr_source: null, duration_secs: null, distance_km: null, summary_line: null, set_lines: [] },
      ]),
      session('2026-07-31', [
        { id: 'e2', session_id: 's2', exercise_name: 'Squat', exercise_type: 'strength', sets: 3, reps: 5, weight_kg: 85, is_pr: false, pr_source: null, duration_secs: null, distance_km: null, summary_line: null, set_lines: [] },
      ]),
    ];

    const s = buildTrainingStatsSummary({ sessions, profile, windowWeeks: 8 });
    const squat = s.topExercises.find((e) => e.name === 'Squat');

    expect(squat?.timesLogged).toBe(2);
    expect(squat?.lastWeightKg).toBe(85); // from the later session
    expect(squat?.lastReps).toBe(5);
  });

  it('returns empty/zeroed fields when there are no sessions', () => {
    const s = buildTrainingStatsSummary({ sessions: [], profile: null, windowWeeks: 8 });
    expect(s.sessionsInWindow).toBe(0);
    expect(s.avgSessionsPerWeek).toBe(0);
    expect(s.topExercises).toEqual([]);
    expect(s.recentFlags).toEqual([]);
    expect(s.goal).toBeNull();
  });
});
