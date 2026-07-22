import type { VoiceDoneMock, VoiceExtractedExerciseMock, VoiceSetRowMock } from '@/app/data/types';
import type {
  EnergyDb,
  MoodDb,
  ExerciseTypeDb,
  WorkoutExerciseExtract,
  WorkoutExtractResult,
  WorkoutSetLineExtract,
} from '@/app/models/workout-extract.models';

const MOOD_UI: Record<MoodDb, { emoji: string; label: string }> = {
  positive: { emoji: '😊', label: 'Positive' },
  neutral: { emoji: '😐', label: 'Neutral' },
  negative: { emoji: '😟', label: 'Tough day' },
};

const ENERGY_UI: Record<EnergyDb, { emoji: string; label: string }> = {
  high: { emoji: '⚡', label: 'High' },
  medium: { emoji: '🔋', label: 'Medium' },
  low: { emoji: '🪫', label: 'Low' },
};

export function workoutExtractToVoiceDoneMock(parsed: WorkoutExtractResult): VoiceDoneMock {
  const flags = parsed.physical_flags.map((s) => s.trim()).filter(Boolean);
  const exerciseList = workoutExercisesToVoiceMocks(parsed.exercises);
  const mood = MOOD_UI[parsed.mood];
  const energy = ENERGY_UI[parsed.energy_level];
  let flagsEmoji = '✓';
  let flagsLabel = 'None noted';
  if (flags.length > 0) {
    flagsEmoji = '⚠️';
    flagsLabel = flags.slice(0, 2).join(', ');
    if (flags.length > 2) {
      flagsLabel += ` +${flags.length - 2}`;
    }
  }

  return {
    sessionTitle: parsed.session_title,
    coachSummary: parsed.coach_summary.trim(),
    cleanedTranscript: parsed.cleaned_transcript.trim(),
    exercises: exerciseList,
    moodEmoji: mood.emoji,
    moodLabel: mood.label,
    energyEmoji: energy.emoji,
    energyLabel: energy.label,
    flagsEmoji,
    flagsLabel,
  };
}

export function workoutExercisesToVoiceMocks(exercises: readonly WorkoutExerciseExtract[]): VoiceExtractedExerciseMock[] {
  return exercises.map((ex) => ({
    name: ex.name,
    detail: ex.summary_line?.trim() || formatExerciseDetailFromLines(ex),
    exerciseType: ex.exercise_type,
    isPr: ex.is_pr,
    setRows: ex.set_lines.map((line, idx) => setLineToRowMock(ex.exercise_type, idx + 1, line)),
  }));
}

/** Single-line summary for lists after user edits (matches AI summary shape). */
export function computeExerciseSummaryLine(
  exercise_type: ExerciseTypeDb,
  set_lines: readonly WorkoutSetLineExtract[],
): string {
  if (set_lines.length === 0) {
    return '';
  }
  return set_lines.map((l) => formatOneLine(exercise_type, l)).join(' · ');
}

function formatExerciseDetailFromLines(ex: WorkoutExerciseExtract): string {
  return ex.set_lines.map((l) => formatOneLine(ex.exercise_type, l)).join(' · ');
}

function setLineToRowMock(
  type: WorkoutExerciseExtract['exercise_type'],
  index: number,
  l: WorkoutSetLineExtract,
): VoiceSetRowMock {
  const repsDisplay = type === 'strength' ? formatRepsDisplay(l) : null;
  const durationDisplay = formatDurationDisplay(l);
  const distanceDisplay = formatDistanceDisplay(l);
  return {
    index,
    sets: l.sets,
    weightKg: type === 'strength' ? l.weight_kg : null,
    repsDisplay,
    durationDisplay,
    distanceDisplay,
    segmentLabel: l.segment_label?.trim() || null,
    bulletLine: formatBulletLine(type, l),
  };
}

function formatRepsDisplay(l: WorkoutSetLineExtract): string | null {
  if (l.reps_min != null && l.reps_max != null) {
    return `${l.reps_min}–${l.reps_max}`;
  }
  if (l.reps != null) {
    return String(l.reps);
  }
  return null;
}

function formatDurationDisplay(l: WorkoutSetLineExtract): string | null {
  if (l.duration_secs == null || l.duration_secs <= 0) {
    return null;
  }
  const s = Math.round(l.duration_secs);
  if (s >= 3600 && s % 3600 === 0) {
    return `${s / 3600} h`;
  }
  if (s % 60 === 0) {
    return `${s / 60} min`;
  }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) {
    return `${m}m ${sec}s`;
  }
  return `${sec}s`;
}

function formatDistanceDisplay(l: WorkoutSetLineExtract): string | null {
  if (l.distance_km == null || l.distance_km <= 0) {
    return null;
  }
  return `${l.distance_km} km`;
}

function formatBulletLine(type: WorkoutExerciseExtract['exercise_type'], l: WorkoutSetLineExtract): string {
  if (type === 'cardio') {
    const p: string[] = [];
    const label = l.segment_label?.trim();
    if (label) {
      p.push(label);
    }
    if (l.sets > 1) {
      p.push(`${l.sets}×`);
    }
    const dur = formatDurationDisplay(l);
    if (dur) {
      p.push(dur);
    }
    const dist = formatDistanceDisplay(l);
    if (dist) {
      p.push(dist);
    }
    return p.join(' · ') || 'Cardio segment';
  }
  const rep = formatRepsDisplay(l) ?? '—';
  const w = l.weight_kg != null ? `@ ${l.weight_kg} kg` : null;
  const setBit = l.sets > 1 ? `${l.sets} sets` : '1 set';
  return w ? `${setBit} · ${rep} reps ${w}` : `${setBit} · ${rep} reps`;
}

function formatOneLine(
  type: WorkoutExerciseExtract['exercise_type'],
  l: WorkoutExerciseExtract['set_lines'][number],
): string {
  if (type === 'cardio') {
    const label = l.segment_label?.trim();
    const prefix = label ? `${label} ` : '';
    const p: string[] = [];
    if (l.duration_secs != null && l.duration_secs > 0) {
      p.push(`${Math.round(l.duration_secs / 60)} min`);
    }
    if (l.distance_km != null && l.distance_km > 0) {
      p.push(`${l.distance_km} km`);
    }
    if (l.sets > 1) {
      p.unshift(`${l.sets}×`);
    }
    const body = p.join(' ').trim() || 'Cardio';
    return `${prefix}${body}`.trim();
  }
  const rep =
    l.reps_min != null && l.reps_max != null
      ? `${l.reps_min}–${l.reps_max}`
      : l.reps != null
        ? String(l.reps)
        : '?';
  const w = l.weight_kg != null ? ` @ ${l.weight_kg} kg` : '';
  const setPrefix = l.sets > 1 ? `${l.sets}×` : '1×';
  return `${setPrefix}${rep}${w}`;
}
