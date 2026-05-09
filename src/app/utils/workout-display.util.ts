import type { EnergyDb } from '@/app/models/workout-extract.models';

/** One row from `exercises_logged.set_lines` JSONB. */
export interface SetLineParsed {
  sets: number;
  weight_kg: number | null;
  reps: number | null;
  reps_min: number | null;
  reps_max: number | null;
  duration_secs: number | null;
  distance_km: number | null;
  segment_label: string | null;
}

export function parseLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Monday 00:00 .. Sunday, as YYYY-MM-DD keys for current week (local). */
export function getCurrentWeekDayKeys(): readonly string[] {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    keys.push(parseLocalDateKey(x));
  }
  return keys;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function formatShortWeekdayLabelsForCurrentWeek(): readonly string[] {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return WEEKDAY_SHORT[x.getDay()] ?? '·';
  });
}

export function formatSessionDateLabel(dateStr: string): string {
  const d = parseIsoDateLocal(dateStr);
  const today = new Date();
  const todayKey = parseLocalDateKey(today);
  if (dateStr === todayKey) return 'Today';

  const yday = new Date(today);
  yday.setDate(today.getDate() - 1);
  if (dateStr === parseLocalDateKey(yday)) return 'Yesterday';

  const sameYear = d.getFullYear() === today.getFullYear();
  if (sameYear) {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function moodEmoji(mood: string | null | undefined): string {
  switch (mood) {
    case 'positive':
      return '😊';
    case 'negative':
      return '😔';
    case 'neutral':
    default:
      return '😐';
  }
}

export function moodLabel(mood: string | null | undefined): string {
  switch (mood) {
    case 'positive':
      return 'Positive';
    case 'negative':
      return 'Low';
    case 'neutral':
    default:
      return 'Neutral';
  }
}

export function energyShortLabel(energy: string | null | undefined): string {
  switch (energy) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
    default:
      return 'Low';
  }
}

export function energyDisplayLabel(energy: string | null | undefined): string {
  const e = energy as EnergyDb | undefined;
  const short = energyShortLabel(e);
  if (e === 'high') return `⚡ ${short}`;
  if (e === 'medium') return `↔ ${short}`;
  return short;
}

export function parseSetLines(raw: unknown): SetLineParsed[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: SetLineParsed[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const sets = Number(o['sets']);
    if (!Number.isFinite(sets)) continue;
    out.push({
      sets,
      weight_kg: o['weight_kg'] == null ? null : Number(o['weight_kg']),
      reps: o['reps'] == null ? null : Number(o['reps']),
      reps_min: o['reps_min'] == null ? null : Number(o['reps_min']),
      reps_max: o['reps_max'] == null ? null : Number(o['reps_max']),
      duration_secs: o['duration_secs'] == null ? null : Number(o['duration_secs']),
      distance_km: o['distance_km'] == null ? null : Number(o['distance_km']),
      segment_label: o['segment_label'] == null ? null : String(o['segment_label']),
    });
  }
  return out;
}

function repsForLine(line: SetLineParsed): number {
  if (line.reps != null && Number.isFinite(line.reps)) return line.reps;
  if (
    line.reps_min != null &&
    line.reps_max != null &&
    Number.isFinite(line.reps_min) &&
    Number.isFinite(line.reps_max)
  ) {
    return (line.reps_min + line.reps_max) / 2;
  }
  if (line.reps_min != null && Number.isFinite(line.reps_min)) return line.reps_min;
  if (line.reps_max != null && Number.isFinite(line.reps_max)) return line.reps_max;
  return 0;
}

/** Approximate tonnage (kg × reps) summed over sets for strength work; cardio contributes 0. */
export function exerciseStrengthVolumeKg(ex: {
  exercise_type: string | null;
  sets: number | null;
  reps: number | null;
  weight_kg: string | number | null;
  set_lines: unknown;
}): number {
  if (ex.exercise_type === 'cardio') return 0;
  const lines = parseSetLines(ex.set_lines);
  if (lines.length > 0) {
    return lines.reduce((sum, l) => {
      const w = l.weight_kg != null && Number.isFinite(l.weight_kg) ? l.weight_kg : 0;
      const r = repsForLine(l);
      return sum + l.sets * r * w;
    }, 0);
  }
  const s = ex.sets ?? 0;
  const r = ex.reps ?? 0;
  const w = ex.weight_kg == null ? 0 : Number(ex.weight_kg);
  return s * r * w;
}

export function formatVolumeKg(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return '—';
  return `${Math.round(kg).toLocaleString()}kg`;
}

export function exerciseListDetailLine(ex: {
  exercise_type: string | null;
  summary_line: string | null;
  sets: number | null;
  reps: number | null;
  weight_kg: string | number | null;
  duration_secs: number | null;
  distance_km: string | number | null;
  set_lines: unknown;
}): string {
  if (ex.summary_line?.trim()) return ex.summary_line.trim();
  if (ex.exercise_type === 'cardio') {
    const parts: string[] = [];
    if (ex.duration_secs != null && ex.duration_secs > 0) {
      const m = Math.round(ex.duration_secs / 60);
      parts.push(`${m} min`);
    }
    if (ex.distance_km != null && Number(ex.distance_km) > 0) {
      parts.push(`~${Number(ex.distance_km).toFixed(1)}km`);
    }
    return parts.join(' · ') || 'Cardio';
  }
  const w = ex.weight_kg == null ? null : Number(ex.weight_kg);
  const sets = ex.sets ?? null;
  const reps = ex.reps ?? null;
  const bits: string[] = [];
  if (sets != null) bits.push(`${sets} sets`);
  if (reps != null) bits.push(`${reps} reps`);
  if (w != null && Number.isFinite(w)) bits.push(`${w}kg`);
  return bits.join(' · ') || 'Strength';
}

interface ExerciseLike {
  exercise_type: string | null;
  sets: number | null;
  reps: number | null;
  weight_kg: string | number | null;
  set_lines: unknown;
}

export function sessionTotalVolumeKg(
  exercises: ReadonlyArray<{ exercise_type: string | null; sets: number | null; reps: number | null; weight_kg: string | number | null; set_lines: unknown }>
): number {
  return exercises.reduce((a, ex) => a + exerciseStrengthVolumeKg(ex), 0);
}

export function buildWeekVolumeSeries(
  sessions: ReadonlyArray<{ date: string | null; exercises_logged: ExerciseLike[] | null }>,
  weekDayKeys: readonly string[]
): number[] {
  const byDay = new Map<string, number>();
  for (const key of weekDayKeys) byDay.set(key, 0);
  for (const s of sessions) {
    if (!s.date) continue;
    const vol = sessionTotalVolumeKg(s.exercises_logged ?? []);
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + vol);
  }
  return weekDayKeys.map((k) => byDay.get(k) ?? 0);
}

/** Dates (YYYY-MM-DD) that have at least one session. */
export function collectSessionDateSet(sessions: ReadonlyArray<{ date: string | null }>): Set<string> {
  const set = new Set<string>();
  for (const s of sessions) {
    if (s.date) set.add(s.date);
  }
  return set;
}

/** Week dots Mon→Sun: label letters match `formatShortWeekdayLabelsForCurrentWeek` order. */
export function buildWeekCompletionDots(
  weekDayKeys: readonly string[],
  shortLabels: readonly string[],
  sessionDates: Set<string>
): { label: string; completed: boolean }[] {
  return weekDayKeys.map((key, i) => ({
    label: shortLabels[i] ?? '?',
    completed: sessionDates.has(key),
  }));
}

/**
 * Count consecutive calendar days with a workout, walking backward from the most recent
 * day (on or before today) that has a session.
 */
export function computeWorkoutStreakDays(sessionDates: Set<string>): number {
  if (sessionDates.size === 0) return 0;
  const cursor = new Date();
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const key = parseLocalDateKey(cursor);
    if (sessionDates.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (streak > 0) {
      break;
    } else {
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  return streak;
}

export function flagsSummary(flags: string[] | null | undefined): { title: string; body: string } {
  const f = flags?.filter((x) => x.trim().length > 0) ?? [];
  if (f.length === 0) return { title: 'Physical Flags', body: 'No issues noted for this session.' };
  return { title: 'Physical Flags', body: f.join(' · ') };
}
