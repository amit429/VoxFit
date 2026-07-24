import type { ExerciseTypeDb } from '@/app/models/exercise-type-db.model';
import type { WorkoutSetLineExtract } from '@/app/models/workout-set-line-extract.model';

export interface WorkoutExerciseExtract {
  readonly name: string;
  readonly exercise_type: ExerciseTypeDb;
  readonly is_pr: boolean;
  /** Compact line for lists; optional if set_lines capture detail. */
  readonly summary_line: string;
  readonly set_lines: readonly WorkoutSetLineExtract[];
}
