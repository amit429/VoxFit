/** Parsed workout from Gemini — matches DB enums + UI. */
export type MoodDb = 'positive' | 'neutral' | 'negative';
export type EnergyDb = 'high' | 'medium' | 'low';
export type ExerciseTypeDb = 'strength' | 'cardio';

/**
 * One load / effort segment. E.g. pyramid: three lines with sets:1 each;
 * uniform 3×10 @ 50kg → one line with sets:3, weight_kg:50, reps:10.
 */
export interface WorkoutSetLineExtract {
  readonly sets: number;
  readonly weight_kg: number | null;
  readonly reps: number | null;
  readonly reps_min: number | null;
  readonly reps_max: number | null;
  readonly duration_secs: number | null;
  readonly distance_km: number | null;
  /**
   * Cardio only: what this segment was (e.g. "Running", "Cycling", "Rowing").
   * Use when one exercise has multiple cardio blocks; null for strength or unspecified.
   */
  readonly segment_label: string | null;
}

export interface WorkoutExerciseExtract {
  readonly name: string;
  readonly exercise_type: ExerciseTypeDb;
  readonly is_pr: boolean;
  /** Compact line for lists; optional if set_lines capture detail. */
  readonly summary_line: string;
  readonly set_lines: readonly WorkoutSetLineExtract[];
}

export interface WorkoutExtractResult {
  readonly session_title: string;
  readonly coach_summary: string;
  readonly mood: MoodDb;
  readonly energy_level: EnergyDb;
  readonly physical_flags: readonly string[];
  readonly exercises: readonly WorkoutExerciseExtract[];
  /**
   * The user's own words, de-duplicated of repeated phrases and cleaned of
   * mobile speech-to-text garbage by Gemini — not a paraphrase/summary. This
   * is what gets shown in the review screen and saved as `raw_transcript`,
   * instead of the raw (often triplicated) browser transcript.
   */
  readonly cleaned_transcript: string;
}
