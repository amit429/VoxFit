export interface HeatmapCellVm {
  readonly key: string;
  readonly intensity: 0 | 1 | 2 | 3 | 4;
  readonly isToday: boolean;
}
