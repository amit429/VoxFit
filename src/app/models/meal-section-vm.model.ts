import type { DietLogListRow } from '@/app/models/diet-log-list-row.model';

export interface MealSectionVm {
  readonly key: string;
  readonly label: string;
  readonly items: readonly DietLogListRow[];
  /** Unique per day+section for `@for` track in week view (outer `day` not allowed in `track`). */
  readonly trackId?: string;
}
