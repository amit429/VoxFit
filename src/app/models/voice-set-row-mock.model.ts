/** One row in the log UI table / bullets (from a model set_line). */
export interface VoiceSetRowMock {
  readonly index: number;
  readonly sets: number;
  readonly weightKg: number | null;
  readonly repsDisplay: string | null;
  readonly durationDisplay: string | null;
  readonly distanceDisplay: string | null;
  readonly segmentLabel: string | null;
  /** Single-line summary for bullet list under the table. */
  readonly bulletLine: string;
}
