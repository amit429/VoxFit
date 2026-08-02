import { assertEquals } from 'jsr:@std/assert';
import { computeNutritionStats, computePlanVsActual, type DietLogRow } from './stats.ts';

Deno.test('computeNutritionStats: avgCalories/avgProteinG are null (not 0) when nothing is logged', () => {
  const rows: DietLogRow[] = [];
  const s = computeNutritionStats(rows, null, 7);
  assertEquals(s.avgCalories, null);
  assertEquals(s.avgProteinG, null);
  assertEquals(s.daysLogged, 0);
});

Deno.test('computeNutritionStats: daysLogged counts DISTINCT dates', () => {
  const rows: DietLogRow[] = [
    { date: '2026-07-30', calories: 500, protein_g: 30 },
    { date: '2026-07-30', calories: 700, protein_g: 40 },
    { date: '2026-07-31', calories: 600, protein_g: 35 },
  ];
  const s = computeNutritionStats(rows, null, 7);
  assertEquals(s.daysLogged, 2);
  assertEquals(s.avgCalories, 600); // (500+700+600)/3 = 600
  assertEquals(s.avgProteinG, 35); // (30+40+35)/3 = 35
});

Deno.test('computePlanVsActual: planned=0 → pct 0, drift severe, no div-by-zero', () => {
  const result = computePlanVsActual(0, 5, 4);
  assertEquals(result.plannedSessions, 0);
  assertEquals(result.adherencePct, 0);
  assertEquals(result.drift, 'severe');
});

Deno.test('computePlanVsActual: adherence caps at 100 even if over-logged', () => {
  const result = computePlanVsActual(3, 10, 1);
  assertEquals(result.plannedSessions, 3);
  assertEquals(result.adherencePct, 100);
  assertEquals(result.drift, 'on_track');
});

Deno.test('computePlanVsActual: drift thresholds — 80%→on_track, 50%→mild, 20%→severe', () => {
  const onTrack = computePlanVsActual(25, 80, 4); // planned = 100, pct = 80
  assertEquals(onTrack.adherencePct, 80);
  assertEquals(onTrack.drift, 'on_track');

  const mild = computePlanVsActual(25, 50, 4); // planned = 100, pct = 50
  assertEquals(mild.adherencePct, 50);
  assertEquals(mild.drift, 'mild');

  const severe = computePlanVsActual(25, 20, 4); // planned = 100, pct = 20
  assertEquals(severe.adherencePct, 20);
  assertEquals(severe.drift, 'severe');
});
