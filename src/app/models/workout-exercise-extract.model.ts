import type { ExerciseTypeDb } from '@/app/models/exercise-type-db.model';
import type { PrSource } from '@/app/models/pr-source.model';
import type { WorkoutSetLineExtract } from '@/app/models/workout-set-line-extract.model';

export interface WorkoutExerciseExtract {
  readonly name: string;
  readonly exercise_type: ExerciseTypeDb;
  readonly is_pr: boolean;
  /** Null for a fresh AI extract; carries the row's existing value through an edit round-trip. */
  readonly pr_source: PrSource;
  /** Compact line for lists; optional if set_lines capture detail. */
  readonly summary_line: string;
  readonly set_lines: readonly WorkoutSetLineExtract[];
}
