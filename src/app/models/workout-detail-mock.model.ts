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
  /** False when the user noted nothing — lets the UI omit the card entirely. */
  readonly hasFlags: boolean;
}
