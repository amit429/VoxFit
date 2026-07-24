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

export interface VoiceExtractedExerciseMock {
  readonly name: string;
  /** One-line summary shown in the collapsed row. */
  readonly detail: string;
  readonly exerciseType: 'strength' | 'cardio';
  readonly isPr: boolean;
  readonly setRows: readonly VoiceSetRowMock[];
}

export interface VoiceDoneMock {
  readonly sessionTitle: string;
  /** Short coach note from AI (maps to ai_summary in DB). */
  readonly coachSummary: string;
  /** De-duplicated/cleaned transcript from Gemini — shown in the review screen only, not persisted. */
  readonly cleanedTranscript: string;
  readonly exercises: readonly VoiceExtractedExerciseMock[];
  readonly moodEmoji: string;
  readonly moodLabel: string;
  readonly energyEmoji: string;
  readonly energyLabel: string;
  readonly flagsEmoji: string;
  readonly flagsLabel: string;
}
