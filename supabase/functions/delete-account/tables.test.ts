import { assertEquals } from 'jsr:@std/assert';
import { USER_SCOPED_TABLES } from './tables.ts';

Deno.test('USER_SCOPED_TABLES: plan_nudges comes before workout_plans (plan_nudges.plan_id -> workout_plans.id, child must delete first)', () => {
  const order = USER_SCOPED_TABLES.map((s) => s.table);
  assertEquals(order.indexOf('plan_nudges') < order.indexOf('workout_plans'), true);
});

Deno.test('USER_SCOPED_TABLES: user_profiles is last (every other table, and auth.users, FKs to it)', () => {
  const last = USER_SCOPED_TABLES[USER_SCOPED_TABLES.length - 1];
  assertEquals(last.table, 'user_profiles');
  assertEquals(last.column, 'id');
});

Deno.test('USER_SCOPED_TABLES: contains exactly these 6 tables, no duplicates', () => {
  const order = USER_SCOPED_TABLES.map((s) => s.table);
  assertEquals(order, ['plan_nudges', 'workout_plans', 'workout_sessions', 'diet_logs', 'progress_reviews', 'user_profiles']);
});

Deno.test('USER_SCOPED_TABLES: every entry except the last is scoped by user_id', () => {
  const nonLast = USER_SCOPED_TABLES.slice(0, -1);
  for (const step of nonLast) {
    assertEquals(step.column, 'user_id');
  }
});
