export interface DailyCalorieRow {
  readonly date: string;
  readonly calories: number;
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
