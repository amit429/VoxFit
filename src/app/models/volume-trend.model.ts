/** The last N weeks of volume against the N before, and against all history. */
export interface VolumeTrend {
  readonly windowWeeks: number;
  readonly currentKg: number;
  readonly previousKg: number;
  /** Change from the previous window, in percent. `0` when incomparable. */
  readonly deltaPct: number;
  /** False when there is not enough history, or no baseline to divide by. */
  readonly hasComparison: boolean;
  /** True when no earlier window of the same length totalled more. */
  readonly isBestStretch: boolean;
  /** Weeks from the first logged week to the current one, gaps included. */
  readonly weeksCovered: number;
}
