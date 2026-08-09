/** One week of training tonnage, from `get_weekly_volume_series`. */
export interface WeeklyVolumePoint {
  /** ISO Monday of the week, `YYYY-MM-DD`. */
  readonly weekStart: string;
  readonly volumeKg: number;
}
