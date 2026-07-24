import type { VoiceSetRowMock } from '@/app/models/voice-set-row-mock.model';

export interface VoiceExtractedExerciseMock {
  readonly name: string;
  /** One-line summary shown in the collapsed row. */
  readonly detail: string;
  readonly exerciseType: 'strength' | 'cardio';
  readonly isPr: boolean;
  readonly setRows: readonly VoiceSetRowMock[];
}
