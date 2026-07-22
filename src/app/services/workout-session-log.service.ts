import { Injectable, inject } from '@angular/core';
import type { WorkoutExtractResult, WorkoutExerciseExtract } from '@/app/models/workout-extract.models';
import { SupabaseService } from '@/app/services/supabase.service';

@Injectable({ providedIn: 'root' })
export class WorkoutSessionLogService {
  private readonly supabase = inject(SupabaseService);

  async saveSession(userId: string, parsed: WorkoutExtractResult): Promise<string> {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sessionInsert = {
      user_id: userId,
      date: dateStr,
      session_label: parsed.session_title,
      ai_summary: parsed.coach_summary || null,
      mood: parsed.mood,
      energy_level: parsed.energy_level,
      physical_flags: [...parsed.physical_flags],
    };

    const { data: sessionRow, error: sessionError } = await this.supabase.client
      .from('workout_sessions')
      .insert(sessionInsert)
      .select('id')
      .single();

    if (sessionError || !sessionRow?.id) {
      console.error('[WorkoutSessionLog]', sessionError);
      throw new Error(sessionError?.message ?? 'Failed to save workout session');
    }

    const sessionId = sessionRow.id as string;
    const exerciseRows = parsed.exercises.map((ex) => {
      const agg = legacyColumnsFromExercise(ex);
      return {
        session_id: sessionId,
        exercise_name: ex.name,
        exercise_type: ex.exercise_type,
        sets: agg.sets,
        reps: agg.reps,
        weight_kg: agg.weight_kg,
        duration_secs: agg.duration_secs,
        distance_km: agg.distance_km,
        is_pr: ex.is_pr,
        summary_line: ex.summary_line || null,
        set_lines: [...ex.set_lines],
      };
    });

    const { error: exError } = await this.supabase.client.from('exercises_logged').insert(exerciseRows);
    if (exError) {
      console.error('[WorkoutSessionLog] exercises', exError);
      throw new Error(exError.message);
    }

    return sessionId;
  }

  /** Replaces all exercises for an existing session (e.g. after editing in the journal). */
  async replaceSessionExercises(sessionId: string, exercises: WorkoutExerciseExtract[]): Promise<void> {
    const { error: delError } = await this.supabase.client.from('exercises_logged').delete().eq('session_id', sessionId);
    if (delError) {
      console.error('[WorkoutSessionLog] delete exercises', delError);
      throw new Error(delError.message);
    }
    if (exercises.length === 0) {
      return;
    }
    const exerciseRows = exercises.map((ex) => {
      const agg = legacyColumnsFromExercise(ex);
      return {
        session_id: sessionId,
        exercise_name: ex.name,
        exercise_type: ex.exercise_type,
        sets: agg.sets,
        reps: agg.reps,
        weight_kg: agg.weight_kg,
        duration_secs: agg.duration_secs,
        distance_km: agg.distance_km,
        is_pr: ex.is_pr,
        summary_line: ex.summary_line || null,
        set_lines: [...ex.set_lines],
      };
    });
    const { error: exError } = await this.supabase.client.from('exercises_logged').insert(exerciseRows);
    if (exError) {
      console.error('[WorkoutSessionLog] insert exercises', exError);
      throw new Error(exError.message);
    }
  }
}

/** Roll-up for legacy scalar columns + simple analytics queries. */
function legacyColumnsFromExercise(ex: WorkoutExerciseExtract): {
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_secs: number | null;
  distance_km: number | null;
} {
  const lines = ex.set_lines;
  const totalSets = lines.reduce((a, l) => a + l.sets, 0) || null;

  if (ex.exercise_type === 'cardio') {
    const dur = lines.reduce((a, l) => a + (l.duration_secs ?? 0), 0);
    const dist = lines.reduce((a, l) => a + (l.distance_km ?? 0), 0);
    return {
      sets: totalSets,
      reps: null,
      weight_kg: null,
      duration_secs: dur > 0 ? dur : null,
      distance_km: dist > 0 ? dist : null,
    };
  }

  const weights = lines.map((l) => l.weight_kg).filter((w): w is number => w != null);
  const maxW = weights.length ? Math.max(...weights) : null;
  const first = lines[0];
  const rep =
    first?.reps ?? first?.reps_max ?? first?.reps_min ?? null;

  return {
    sets: totalSets,
    reps: rep,
    weight_kg: maxW,
    duration_secs: null,
    distance_km: null,
  };
}
