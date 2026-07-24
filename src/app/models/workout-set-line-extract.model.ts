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
