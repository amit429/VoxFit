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
