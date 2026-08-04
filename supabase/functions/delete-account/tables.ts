/**
 * Tables deleted (in order) when a user deletes their account, scoped by the given column.
 * None of these FKs have ON DELETE CASCADE, so children must be deleted before parents.
 * plan_nudges.plan_id -> workout_plans.id, so plan_nudges goes first. Every table here FKs
 * to user_profiles directly, and user_profiles is what auth.users FKs to — so it's last.
 * exercises_logged isn't in this list: it has no user_id column, it's scoped via the
 * user's workout_sessions and deleted separately in index.ts before this list runs.
 */
export interface UserScopedTableStep {
  readonly table: string;
  readonly column: 'user_id' | 'id';
}

export const USER_SCOPED_TABLES: readonly UserScopedTableStep[] = [
  { table: 'plan_nudges', column: 'user_id' },
  { table: 'workout_plans', column: 'user_id' },
  { table: 'workout_sessions', column: 'user_id' },
  { table: 'diet_logs', column: 'user_id' },
  { table: 'progress_reviews', column: 'user_id' },
  { table: 'user_profiles', column: 'id' },
];
