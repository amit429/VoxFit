export interface HomeWorkoutCardMock {
  readonly title: string;
  readonly subtitle: string;
  readonly statusLabel: string;
  readonly statusTone: 'success' | 'muted';
  readonly exerciseChips: readonly string[];
  readonly coachTitle: string;
  readonly coachNote: string;
}
