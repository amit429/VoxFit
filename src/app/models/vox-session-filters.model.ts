import type { MoodDb } from './mood-db.model';

export interface VoxSessionFilters {
  readonly moods: readonly MoodDb[];
  readonly prsOnly: boolean;
  readonly notesOnly: boolean;
}
