// Deno runtime — no @/* aliases. Shapes duplicated from src/app/models by hand.
export interface ExerciseRow {
  exercise_name: string;
  exercise_type: 'strength' | 'cardio' | null;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  is_pr: boolean | null;
}
export interface SessionRow {
  date: string | null;
  physical_flags: string[] | null;
  exercises_logged: ExerciseRow[] | null;
}
export interface ProfileRow {
  goal: string | null;
  sport_type: string | null;
  target_calories: number | null;
  target_protein_g: number | null;
}
export interface TopExerciseStat {
  name: string;
  type: 'strength' | 'cardio' | null;
  timesLogged: number;
  lastWeightKg: number | null;
  lastReps: number | null;
}
export interface TrainingStatsSummary {
  goal: string | null;
  sportType: string | null;
  targetCalories: number | null;
  targetProteinG: number | null;
  windowWeeks: number;
  sessionsInWindow: number;
  avgSessionsPerWeek: number;
  currentStreakDays: number;
  weeklyVolumeKg: number[];
  prCount: number;
  topExercises: TopExerciseStat[];
  recentFlags: string[];
}

export function computeRecurringFlags(rows: SessionRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) for (const f of r.physical_flags ?? []) {
    const t = f.trim();
    if (t) set.add(t);
  }
  return [...set];
}

export function computeTrainingStats(
  rows: SessionRow[],
  profile: ProfileRow | null,
  windowWeeks: number,
  topN: number,
): TrainingStatsSummary {
  const sessions = [...rows].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const sessionsInWindow = sessions.length;
  const avgSessionsPerWeek = windowWeeks > 0 ? Math.round((sessionsInWindow / windowWeeks) * 10) / 10 : 0;

  let prCount = 0;
  const byExercise = new Map<string, TopExerciseStat & { lastDate: string }>();
  const weeklyVolumeKg = new Array<number>(Math.max(1, windowWeeks)).fill(0);
  const today = Date.now();

  for (const s of sessions) {
    let sessionVolume = 0;
    for (const ex of s.exercises_logged ?? []) {
      if (ex.is_pr) prCount++;
      sessionVolume += (ex.sets ?? 0) * (ex.reps ?? 0) * (ex.weight_kg ?? 0);
      const name = ex.exercise_name.trim();
      if (!name) continue;
      const prev = byExercise.get(name);
      const isLater = !prev || (s.date ?? '') >= prev.lastDate;
      byExercise.set(name, {
        name,
        type: ex.exercise_type ?? prev?.type ?? null,
        timesLogged: (prev?.timesLogged ?? 0) + 1,
        lastWeightKg: isLater ? ex.weight_kg ?? null : prev?.lastWeightKg ?? null,
        lastReps: isLater ? ex.reps ?? null : prev?.lastReps ?? null,
        lastDate: isLater ? s.date ?? '' : prev?.lastDate ?? '',
      });
    }
    if (s.date) {
      const daysAgo = Math.floor((today - new Date(`${s.date}T00:00:00`).getTime()) / 86_400_000);
      const idx = weeklyVolumeKg.length - 1 - Math.floor(daysAgo / 7);
      if (idx >= 0 && idx < weeklyVolumeKg.length) weeklyVolumeKg[idx] += Math.round(sessionVolume);
    }
  }

  const topExercises = [...byExercise.values()]
    .sort((a, b) => b.timesLogged - a.timesLogged)
    .slice(0, topN)
    .map(({ name, type, timesLogged, lastWeightKg, lastReps }) => ({ name, type, timesLogged, lastWeightKg, lastReps }));

  return {
    goal: profile?.goal ?? null,
    sportType: profile?.sport_type ?? null,
    targetCalories: profile?.target_calories ?? null,
    targetProteinG: profile?.target_protein_g ?? null,
    windowWeeks,
    sessionsInWindow,
    avgSessionsPerWeek,
    currentStreakDays: 0, // streak intentionally omitted server-side in Plan 1; added with the shared helper in Plan 2
    weeklyVolumeKg,
    prCount,
    topExercises,
    recentFlags: computeRecurringFlags(rows),
  };
}
