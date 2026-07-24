import type { EnergyDb } from '@/app/models/energy-db.model';
import type { MoodDb } from '@/app/models/mood-db.model';
import type { WorkoutExerciseExtract } from '@/app/models/workout-exercise-extract.model';

export interface WorkoutExtractResult {
  readonly session_title: string;
  readonly coach_summary: string;
  readonly mood: MoodDb;
  readonly energy_level: EnergyDb;
  readonly physical_flags: readonly string[];
  readonly exercises: readonly WorkoutExerciseExtract[];
  /**
   * The user's own words, de-duplicated of repeated phrases and cleaned of
   * mobile speech-to-text garbage by Gemini — not a paraphrase/summary. Shown
   * in the review screen only; not persisted (nothing reads it back after save).
   */
  readonly cleaned_transcript: string;
}
