import type { ExerciseLoggedLike, WorkoutExerciseExtract, WorkoutSetLineExtract } from '@/app/models';
import { parseSetLines } from '@/app/utils/workout-display.util';

function legacySetLinesFromRow(row: ExerciseLoggedLike): WorkoutSetLineExtract[] {
  const type = row.exercise_type === 'cardio' ? 'cardio' : 'strength';
  if (type === 'cardio') {
    return [
      {
        sets: row.sets != null && row.sets > 0 ? row.sets : 1,
        weight_kg: null,
        reps: null,
        reps_min: null,
        reps_max: null,
        duration_secs: row.duration_secs,
        distance_km: row.distance_km == null ? null : Number(row.distance_km),
        segment_label: null,
      },
    ];
  }
  return [
    {
      sets: row.sets != null && row.sets > 0 ? row.sets : 1,
      weight_kg: row.weight_kg == null ? null : Number(row.weight_kg),
      reps: row.reps,
      reps_min: null,
      reps_max: null,
      duration_secs: null,
      distance_km: null,
      segment_label: null,
    },
  ];
}

export function exerciseLoggedLikeToExtract(row: ExerciseLoggedLike): WorkoutExerciseExtract {
  const type = row.exercise_type === 'cardio' ? 'cardio' : 'strength';
  const rawLines = parseSetLines(row.set_lines).map(
    (l): WorkoutSetLineExtract => ({
      sets: l.sets,
      weight_kg: l.weight_kg,
      reps: l.reps,
      reps_min: l.reps_min,
      reps_max: l.reps_max,
      duration_secs: l.duration_secs,
      distance_km: l.distance_km,
      segment_label: l.segment_label?.trim() || null,
    }),
  );
  const set_lines = rawLines.length > 0 ? rawLines : legacySetLinesFromRow(row);
  return {
    name: row.exercise_name,
    exercise_type: type,
    is_pr: row.is_pr ?? false,
    summary_line: row.summary_line?.trim() ?? '',
    set_lines,
  };
}

export function exerciseLoggedLikesToExtracts(rows: readonly ExerciseLoggedLike[]): WorkoutExerciseExtract[] {
  return rows.map(exerciseLoggedLikeToExtract);
}
