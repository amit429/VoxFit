export interface WorkoutSessionListMock {
  readonly id: string;
  readonly label: string;
  readonly dateLabel: string;
  /** `YYYY-MM-DD` for filtering (week range). */
  readonly dateKey: string;
  readonly exercises: number;
  readonly moodEmoji: string;
  readonly energyLabel: string;
  readonly hasFlag: boolean;
  readonly hasPr: boolean;
}
