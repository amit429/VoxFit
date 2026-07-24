/** Lean exercise shape for the paginated journal list — only what `sessionToListItem` touches. */
export interface ExerciseLoggedListRow {
  id: string;
  is_pr: boolean | null;
}
