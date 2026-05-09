import type { ExerciseTypeDb, WorkoutExerciseExtract, WorkoutSetLineExtract } from '@/app/models/workout-extract.models';
import { computeExerciseSummaryLine } from '@/app/utils/workout-extract-ui.mapper';

/** Mutable row for the exercise editor form. */
export interface ExerciseSetLineDraft {
  sets: string;
  weight_kg: string;
  /** Strength: single rep count or range "10-12" / "10–12". */
  reps: string;
  /** Cardio: minutes (decimal ok). */
  duration_mins: string;
  distance_km: string;
  segment_label: string;
}

export interface ExerciseEditorFormModel {
  name: string;
  exercise_type: ExerciseTypeDb;
  is_pr: boolean;
  setLines: ExerciseSetLineDraft[];
}

export function exerciseToFormModel(ex: WorkoutExerciseExtract): ExerciseEditorFormModel {
  return {
    name: ex.name,
    exercise_type: ex.exercise_type,
    is_pr: ex.is_pr,
    setLines: ex.set_lines.map(setLineToDraft),
  };
}

export function emptySetLineDraft(type: ExerciseTypeDb): ExerciseSetLineDraft {
  if (type === 'cardio') {
    return { sets: '1', weight_kg: '', reps: '', duration_mins: '', distance_km: '', segment_label: '' };
  }
  return { sets: '1', weight_kg: '', reps: '', duration_mins: '', distance_km: '', segment_label: '' };
}

export function formModelToExercise(model: ExerciseEditorFormModel): WorkoutExerciseExtract | null {
  const name = model.name.trim();
  if (!name) {
    return null;
  }
  const lines: WorkoutSetLineExtract[] = [];
  for (const d of model.setLines) {
    const line = draftToSetLine(model.exercise_type, d);
    if (line) {
      lines.push(line);
    }
  }
  if (lines.length === 0) {
    return null;
  }
  const summary_line = computeExerciseSummaryLine(model.exercise_type, lines);
  return {
    name,
    exercise_type: model.exercise_type,
    is_pr: model.is_pr,
    summary_line,
    set_lines: lines,
  };
}

function setLineToDraft(l: WorkoutSetLineExtract): ExerciseSetLineDraft {
  let reps = '';
  if (l.reps_min != null && l.reps_max != null) {
    reps = `${l.reps_min}–${l.reps_max}`;
  } else if (l.reps != null) {
    reps = String(l.reps);
  }
  let duration_mins = '';
  if (l.duration_secs != null && l.duration_secs > 0) {
    duration_mins = String(roundToPlaces(l.duration_secs / 60, 2));
  }
  return {
    sets: String(l.sets > 0 ? l.sets : 1),
    weight_kg: l.weight_kg != null ? String(l.weight_kg) : '',
    reps,
    duration_mins,
    distance_km: l.distance_km != null && l.distance_km > 0 ? String(l.distance_km) : '',
    segment_label: l.segment_label?.trim() ?? '',
  };
}

function draftToSetLine(type: ExerciseTypeDb, d: ExerciseSetLineDraft): WorkoutSetLineExtract | null {
  const sets = parsePositiveInt(d.sets, 1);
  if (type === 'cardio') {
    const duration_secs = parseDurationSecsFromMins(d.duration_mins);
    const distance_km = parseOptionalFloat(d.distance_km);
    const segment = d.segment_label.trim() || null;
    if (duration_secs == null && distance_km == null && !segment) {
      return null;
    }
    return {
      sets,
      weight_kg: null,
      reps: null,
      reps_min: null,
      reps_max: null,
      duration_secs,
      distance_km,
      segment_label: segment,
    };
  }
  const weight_kg = parseOptionalFloat(d.weight_kg);
  const { reps, reps_min, reps_max } = parseRepsFields(d.reps);
  if (reps == null && reps_min == null && reps_max == null && weight_kg == null) {
    return null;
  }
  return {
    sets,
    weight_kg,
    reps,
    reps_min,
    reps_max,
    duration_secs: null,
    distance_km: null,
    segment_label: null,
  };
}

function parsePositiveInt(s: string, fallback: number): number {
  const n = parseInt(String(s).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseOptionalFloat(s: string): number | null {
  const t = String(s).trim().replace(',', '.');
  if (!t) {
    return null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function parseDurationSecsFromMins(s: string): number | null {
  const t = String(s).trim();
  if (!t) {
    return null;
  }
  const mins = parseFloat(t.replace(',', '.'));
  if (!Number.isFinite(mins) || mins <= 0) {
    return null;
  }
  return Math.max(1, Math.round(mins * 60));
}

function parseRepsFields(s: string): {
  reps: number | null;
  reps_min: number | null;
  reps_max: number | null;
} {
  const t = String(s).trim();
  if (!t) {
    return { reps: null, reps_min: null, reps_max: null };
  }
  const norm = t.replace(/—/g, '-');
  const parts = norm.split(/\s*-\s*/);
  if (parts.length === 2) {
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { reps: null, reps_min: Math.min(a, b), reps_max: Math.max(a, b) };
    }
  }
  const n = parseInt(norm, 10);
  return Number.isFinite(n) ? { reps: n, reps_min: null, reps_max: null } : { reps: null, reps_min: null, reps_max: null };
}

function roundToPlaces(n: number, places: number): number {
  const p = 10 ** places;
  return Math.round(n * p) / p;
}
