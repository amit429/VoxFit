import type { ExerciseSetLineDraft } from '@/app/models/exercise-set-line-draft.model';
import type { ExerciseTypeDb } from '@/app/models/exercise-type-db.model';
import type { PrSource } from '@/app/models/pr-source.model';

export interface ExerciseEditorFormModel {
  name: string;
  exercise_type: ExerciseTypeDb;
  is_pr: boolean;
  pr_source: PrSource;
  setLines: ExerciseSetLineDraft[];
}
