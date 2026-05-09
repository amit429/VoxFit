/** Shared shapes for mock / future API alignment. */

export interface HomeStreakMock {
  readonly days: number;
  readonly weekDots: readonly { readonly label: string; readonly completed: boolean }[];
}

export interface HomeWorkoutCardMock {
  readonly title: string;
  readonly subtitle: string;
  readonly statusLabel: string;
  readonly statusTone: 'success' | 'muted';
  readonly exerciseChips: readonly string[];
  readonly coachTitle: string;
  readonly coachNote: string;
}

export interface MacroRowMock {
  readonly label: string;
  readonly current: number;
  readonly target: number;
}

export interface HomeMacrosMock {
  readonly rows: readonly MacroRowMock[];
  readonly hint?: string;
}

export interface WorkoutSessionListMock {
  readonly label: string;
  readonly dateLabel: string;
  readonly exercises: number;
  readonly moodEmoji: string;
  readonly energyLabel: string;
  readonly hasFlag: boolean;
  readonly hasPr: boolean;
}

export interface WorkoutDetailMock {
  readonly title: string;
  readonly dateLabel: string;
  readonly moodEmoji: string;
  readonly moodLabel: string;
  readonly energyLabel: string;
  readonly volumeLabel: string;
  readonly coachNote: string;
  readonly exercises: readonly { readonly name: string; readonly detail: string; readonly pr: boolean }[];
  readonly flagsTitle: string;
  readonly flagsBody: string;
}

export interface WeeklyVolumeMock {
  readonly label: string;
  readonly values: readonly number[];
  readonly dayLabels: readonly string[];
}

export interface DietMealMock {
  readonly name: string;
  readonly prepMinutes: number;
  readonly calories: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  readonly rationale: string;
}

export interface ProfileGoalRowMock {
  readonly label: string;
  readonly value: string;
}

export interface VoiceExtractedExerciseMock {
  readonly name: string;
  readonly detail: string;
}

export interface VoiceDoneMock {
  readonly sessionTitle: string;
  readonly exercises: readonly VoiceExtractedExerciseMock[];
  readonly moodEmoji: string;
  readonly moodLabel: string;
  readonly energyEmoji: string;
  readonly energyLabel: string;
  readonly flagsEmoji: string;
  readonly flagsLabel: string;
}
