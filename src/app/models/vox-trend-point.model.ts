export interface VoxTrendPoint {
  /** X-axis label, e.g. `W3`. Only a sample are rendered, to avoid crowding. */
  readonly label: string;
  readonly value: number;
  /** True when this session set a personal record. */
  readonly isPr?: boolean;
}
