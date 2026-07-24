import type { VoiceExtractedExerciseMock } from '@/app/models/voice-extracted-exercise-mock.model';

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
