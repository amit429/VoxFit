import type { MoodDb } from '@/app/models/mood-db.model';

export interface WorkoutSessionListMock {
  readonly id: string;
  readonly label: string;
  readonly dateLabel: string;
  /** `YYYY-MM-DD` for filtering (week range). */
  readonly dateKey: string;
  readonly exercises: number;
  /**
   * The stored mood, for filtering. Kept alongside `moodEmoji` rather than
   * derived back from it: `moodEmoji(null)` and `moodEmoji('neutral')` both
   * render 😐, so filtering on the glyph would sweep in sessions that have no
   * recorded mood at all.
   */
  readonly mood: MoodDb | null;
  readonly moodEmoji: string;
  readonly energyLabel: string;
  readonly hasFlag: boolean;
  readonly hasPr: boolean;
}
