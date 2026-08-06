export interface VoxVolumeBar {
  readonly label: string;
  readonly value: number;
  /** Marks the current day; rendered in brand periwinkle. */
  readonly isToday?: boolean;
}
