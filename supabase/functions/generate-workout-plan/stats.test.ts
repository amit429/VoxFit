import { assertEquals } from 'jsr:@std/assert';
import { computeTrainingStats, type SessionRow } from './stats.ts';

Deno.test('computeTrainingStats counts sessions, PRs, and most-recent numbers', () => {
  const rows: SessionRow[] = [
    { date: '2026-07-28', physical_flags: ['knee felt off'], exercises_logged: [
      { exercise_name: 'Squat', exercise_type: 'strength', sets: 3, reps: 5, weight_kg: 80, is_pr: true },
    ] },
    { date: '2026-07-31', physical_flags: ['knee felt off'], exercises_logged: [
      { exercise_name: 'Squat', exercise_type: 'strength', sets: 3, reps: 5, weight_kg: 85, is_pr: false },
    ] },
  ];
  const s = computeTrainingStats(rows, { goal: 'bulk', sport_type: 'gym', target_calories: 2600, target_protein_g: 170 }, 8, 5);
  assertEquals(s.sessionsInWindow, 2);
  assertEquals(s.prCount, 1);
  assertEquals(s.recentFlags, ['knee felt off']);
  const squat = s.topExercises.find((e) => e.name === 'Squat');
  assertEquals(squat?.lastWeightKg, 85);
});
