-- 0001_workout_plans.sql
-- First versioned migration for VoxFit. Introduces the on-demand AI workout plan table.
create table if not exists public.workout_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.user_profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  status         text not null default 'active'
                   check (status in ('active', 'archived', 'superseded')),
  start_date     date not null,
  end_date       date not null,
  source         text not null default 'on_demand'
                   check (source in ('on_demand', 'nudge_refresh')),
  ai_rationale   text check (ai_rationale is null or char_length(ai_rationale) <= 5000),
  plan           jsonb not null default '{}'::jsonb,
  stats_snapshot jsonb not null default '{}'::jsonb
);

alter table public.workout_plans enable row level security;

create index if not exists workout_plans_user_status_idx
  on public.workout_plans (user_id, status);

-- At most one active plan per user (enforced at the DB, not just the app).
create unique index if not exists workout_plans_one_active_per_user
  on public.workout_plans (user_id)
  where status = 'active';

create policy "workout_plans_select_own" on public.workout_plans
  for select using (auth.uid() = user_id);
create policy "workout_plans_insert_own" on public.workout_plans
  for insert with check (auth.uid() = user_id);
create policy "workout_plans_update_own" on public.workout_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
