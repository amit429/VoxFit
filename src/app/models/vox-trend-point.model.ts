export interface VoxTrendPoint {
  /**
   * Local date key (`YYYY-MM-DD`) of the session this point came from.
   *
   * Replaced a positional label (`S1`, `W3`, `NOW`). The chart positions points
   * by elapsed time, so it needs the real date, not the ordinal: with ordinals
   * a two-day gap and a month-long plateau drew the same slope, which is
   * precisely the thing a progression chart must not do.
   */
  readonly dateKey: string;
  readonly value: number;
  /** True when this session set a personal record. */
  readonly isPr?: boolean;
}
