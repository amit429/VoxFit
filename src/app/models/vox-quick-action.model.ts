/** Which accent a quick-action tile carries, so the row is scannable by colour. */
export type VoxQuickActionTone = 'jade' | 'apricot' | 'brand' | 'slate';

export interface VoxQuickAction {
  readonly icon: string;
  /** Two short lines, e.g. `['log', 'workout']` — matches the stacked label. */
  readonly label: readonly [string, string];
  readonly link: string;
  readonly tone: VoxQuickActionTone;
}
