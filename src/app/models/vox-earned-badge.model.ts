/** Tone follows what the badge measures, not its rarity. */
export type VoxBadgeShelfTone = 'apricot' | 'jade' | 'brand' | 'slate';

export interface VoxEarnedBadge {
  readonly key: string;
  readonly emoji: string;
  /** Short caption under the tile, e.g. `14 DAYS`. */
  readonly label: string;
  readonly earned: boolean;
  readonly tone: VoxBadgeShelfTone;
}
