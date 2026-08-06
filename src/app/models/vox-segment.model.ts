export interface VoxSegment<T extends string = string> {
  readonly id: T;
  readonly label: string;
}
