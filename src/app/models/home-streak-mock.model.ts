export interface HomeStreakMock {
  readonly days: number;
  readonly weekDots: readonly { readonly label: string; readonly completed: boolean }[];
}
