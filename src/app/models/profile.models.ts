export interface ProfileGoalRowMock {
  readonly label: string;
  readonly value: string;
}

export interface HeatmapCellVm {
  readonly key: string;
  readonly intensity: 0 | 1 | 2 | 3 | 4;
  readonly isToday: boolean;
}

export interface MonthlyBarVm {
  readonly label: string;
  readonly heightPx: number;
  readonly isCurrent: boolean;
  readonly isSelected: boolean;
}

export interface MonthlyChartStatVm {
  readonly caption: string;
  readonly value: number;
  readonly unit: string;
}
