import type {
  TopExerciseStat,
  TrainingStatsSummary,
  UserProfile,
  WorkoutSessionRow,
} from '@/app/models';
import { computeWorkoutStreakDays, sessionTotalVolumeKg } from '@/app/utils/workout-display.util';

interface BuildInput {
  sessions: WorkoutSessionRow[];
  profile: UserProfile | null;
  windowWeeks: number;
  /** How many top exercises to include. Tunable cost/quality knob. */
  topN?: number;
}

/** Pure aggregation of recent training into a bounded, model-ready digest. */
export function buildTrainingStatsSummary(input: BuildInput): TrainingStatsSummary {
  const { profile, windowWeeks } = input;
  const topN = input.topN ?? 6;
  const sessions = [...input.sessions].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  const sessionsInWindow = sessions.length;
  const avgSessionsPerWeek =
    windowWeeks > 0 ? Math.round((sessionsInWindow / windowWeeks) * 10) / 10 : 0;

  const dateSet = new Set(sessions.map((s) => s.date).filter((d): d is string => !!d));
  const currentStreakDays = computeWorkoutStreakDays(dateSet);

  const weeklyVolumeKg = buildWeeklyVolume(sessions, windowWeeks);

  let prCount = 0;
  const flagSet = new Set<string>();
  const byExercise = new Map<string, TopExerciseStat & { lastDate: string }>();

  for (const s of sessions) {
    for (const f of s.physical_flags ?? []) {
      const t = f.trim();
      if (t) flagSet.add(t);
    }
    for (const ex of s.exercises_logged ?? []) {
      if (ex.is_pr) prCount++;
      const name = ex.exercise_name.trim();
      if (!name) continue;
      const prev = byExercise.get(name);
      const isLater = !prev || (s.date ?? '') >= prev.lastDate;
      byExercise.set(name, {
        name,
        type: ex.exercise_type ?? prev?.type ?? null,
        timesLogged: (prev?.timesLogged ?? 0) + 1,
        lastWeightKg: isLater
          ? ex.weight_kg == null
            ? null
            : Number(ex.weight_kg)
          : prev?.lastWeightKg ?? null,
        lastReps: isLater ? (ex.reps ?? null) : prev?.lastReps ?? null,
        lastDate: isLater ? (s.date ?? '') : prev?.lastDate ?? '',
      });
    }
  }

  const topExercises: TopExerciseStat[] = [...byExercise.values()]
    .sort((a, b) => b.timesLogged - a.timesLogged)
    .slice(0, topN)
    .map(({ name, type, timesLogged, lastWeightKg, lastReps }) => ({
      name,
      type,
      timesLogged,
      lastWeightKg,
      lastReps,
    }));

  return {
    goal: profile?.goal ?? null,
    sportType: profile?.sport_type ?? null,
    targetCalories: profile?.target_calories ?? null,
    targetProteinG: profile?.target_protein_g ?? null,
    windowWeeks,
    sessionsInWindow,
    avgSessionsPerWeek,
    currentStreakDays,
    weeklyVolumeKg,
    prCount,
    topExercises,
    recentFlags: [...flagSet],
  };
}

function buildWeeklyVolume(sortedSessions: WorkoutSessionRow[], windowWeeks: number): number[] {
  const weeks = Math.max(1, windowWeeks);
  const buckets = new Array<number>(weeks).fill(0);
  if (sortedSessions.length === 0) return buckets;
  const today = new Date();
  for (const s of sortedSessions) {
    if (!s.date) continue;
    const d = new Date(`${s.date}T00:00:00`);
    const daysAgo = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
    const weekIndex = weeks - 1 - Math.floor(daysAgo / 7);
    if (weekIndex < 0 || weekIndex >= weeks) continue;
    buckets[weekIndex] += Math.round(sessionTotalVolumeKg(s.exercises_logged ?? []));
  }
  return buckets;
}
