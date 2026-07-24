/** Minimal row for streak/heatmap/monthly-count aggregation — no join, no heavy columns. */
export interface WorkoutActivityRow {
  id: string;
  date: string | null;
}
