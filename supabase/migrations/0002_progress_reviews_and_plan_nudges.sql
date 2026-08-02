-- 0002_progress_reviews_and_plan_nudges.sql
-- Weekly AI progress coach + plan-vs-actual nudge. Writes are deterministic
-- (orchestrator, never the model). Idempotent per user per week.

create table if not exists public.progress_reviews (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.user_profiles(id) on delete cascade,
  created_at         timestamptz not null default now(),
  period_start       date not null,
  period_end         date not null,
  generated_for_week date not null,                     -- idempotency key (Monday of the week)
  headline_tone      text not null default 'neutral'
                       check (headline_tone in ('positive', 'neutral', 'attention')),
  acknowledged_at    timestamptz,
  review             jsonb not null default '{}'::jsonb, -- { highlights, trends, recurringNotes, suggestions }
  stats_snapshot     jsonb not null default '{}'::jsonb
);

alter table public.progress_reviews enable row level security;

create index if not exists progress_reviews_user_created_idx
  on public.progress_reviews (user_id, created_at desc);

create unique index if not exists progress_reviews_one_per_week
  on public.progress_reviews (user_id, generated_for_week);

create policy "progress_reviews_select_own" on public.progress_reviews
  for select using (auth.uid() = user_id);
create policy "progress_reviews_insert_own" on public.progress_reviews
  for insert with check (auth.uid() = user_id);
create policy "progress_reviews_update_own" on public.progress_reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.plan_nudges (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.user_profiles(id) on delete cascade,
  plan_id            uuid not null references public.workout_plans(id) on delete cascade,
  created_at         timestamptz not null default now(),
  period_start       date not null,
  period_end         date not null,
  generated_for_week date not null,                     -- idempotency key
  suggests_refresh   boolean not null default false,    -- Flavor-B drift escape hatch
  planned_sessions   int not null default 0,
  completed_sessions int not null default 0,
  acknowledged_at    timestamptz,
  nudge              jsonb not null default '{}'::jsonb  -- { executionNotes, focusThisWeek, driftReason }
);

alter table public.plan_nudges enable row level security;

create index if not exists plan_nudges_user_created_idx
  on public.plan_nudges (user_id, created_at desc);

create unique index if not exists plan_nudges_one_per_week
  on public.plan_nudges (user_id, generated_for_week);

create policy "plan_nudges_select_own" on public.plan_nudges
  for select using (auth.uid() = user_id);
create policy "plan_nudges_insert_own" on public.plan_nudges
  for insert with check (auth.uid() = user_id);
create policy "plan_nudges_update_own" on public.plan_nudges
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
