-- Weekly session target + a persisted badge ledger.
--
-- Two gaps this closes:
--   1. The "sessions this week" ring had no real target. It fell back to the
--      active plan's day count, or 5 — so the number moved when the plan
--      changed and existed at all only if a plan did.
--   2. Badges were derived on the client from live counts every render. That
--      meant no earned-at date, and a badge silently un-earned itself when the
--      streak it was awarded for lapsed.
--
-- Awarding happens on read, inside `get_user_progress_stats`, rather than in a
-- write trigger. It is idempotent (ON CONFLICT DO NOTHING), keeps the
-- threshold logic in exactly one place, and cannot be skipped by a write path
-- that forgets to call it. Only the workout tables feed these metrics, so
-- there is nothing for a meal write to trigger.

-- ---------------------------------------------------------------------------
-- 1. Weekly session target
-- ---------------------------------------------------------------------------

alter table public.user_profiles
  add column if not exists weekly_session_target integer not null default 4;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_weekly_session_target_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_weekly_session_target_check
      check (weekly_session_target between 1 and 14);
  end if;
end $$;

comment on column public.user_profiles.weekly_session_target is
  'Sessions per week the user is aiming for. Set during onboarding, editable in Settings.';

-- ---------------------------------------------------------------------------
-- 2. Badge definitions — the awarding authority
--
-- Thresholds live here, not in app code, so the server decides what is earned
-- and a client cannot grant itself a badge. The app owns presentation only
-- (emoji, caption, tone) keyed by badge_key; see badge.service.ts.
-- ---------------------------------------------------------------------------

create table if not exists public.badge_definitions (
  badge_key text primary key,
  metric text not null check (metric in ('streak', 'workouts', 'prs')),
  threshold integer not null check (threshold > 0),
  sort_order integer not null default 0
);

-- Readable by any signed-in user: these are static rules, not user data.
alter table public.badge_definitions enable row level security;

drop policy if exists badge_definitions_select_all on public.badge_definitions;
create policy badge_definitions_select_all
  on public.badge_definitions
  for select
  to authenticated
  using (true);

insert into public.badge_definitions (badge_key, metric, threshold, sort_order) values
  ('streak_3',   'streak',    3,  10),
  ('pr_1',       'prs',       1,  20),
  ('logs_10',    'workouts',  10, 30),
  ('streak_7',   'streak',    7,  40),
  ('logs_50',    'workouts',  50, 50),
  ('pr_10',      'prs',       10, 60),
  ('streak_14',  'streak',    14, 70),
  ('logs_100',   'workouts', 100, 80),
  ('pr_25',      'prs',       25, 90),
  ('streak_30',  'streak',    30, 100),
  ('logs_250',   'workouts', 250, 110),
  ('pr_50',      'prs',       50, 120),
  ('streak_100', 'streak',   100, 130)
on conflict (badge_key) do update
  set metric = excluded.metric,
      threshold = excluded.threshold,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 3. Badge ledger
-- ---------------------------------------------------------------------------

create table if not exists public.user_badges (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  badge_key text not null references public.badge_definitions(badge_key) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

alter table public.user_badges enable row level security;

-- Read-only to the owner. There is deliberately no insert/update/delete
-- policy: the security-definer function below is the only writer, so a badge
-- cannot be self-granted from the client.
drop policy if exists user_badges_select_own on public.user_badges;
create policy user_badges_select_own
  on public.user_badges
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists user_badges_user_earned_idx
  on public.user_badges (user_id, earned_at desc);

-- ---------------------------------------------------------------------------
-- 4. Current streak, server-side
--
-- Same semantics as the client's computeWorkoutStreakDays: consecutive days
-- ending today or yesterday (today may not be logged yet), 0 otherwise.
--
-- `p_today` is passed in rather than using current_date: the `date` column
-- holds the user's *local* date, while current_date is the server's, so a user
-- far from UTC would see their streak break or extend by a day.
-- ---------------------------------------------------------------------------

create or replace function public.current_workout_streak(p_user uuid, p_today date)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  with days as (
    select distinct date as d
    from workout_sessions
    where user_id = p_user
      and date is not null
      and date <= p_today
  ),
  -- Consecutive dates share (date - row_number), so grouping on it yields runs.
  grouped as (
    select d, d - (row_number() over (order by d))::integer as grp
    from days
  ),
  runs as (
    select grp, max(d) as last_day, count(*)::integer as run_length
    from grouped
    group by grp
  )
  select coalesce(
    (
      select run_length
      from runs
      where last_day >= p_today - 1
      order by last_day desc
      limit 1
    ),
    0
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. One call for stats + badges
--
-- Replaces two count-only round trips plus client-side badge evaluation with a
-- single RPC that also awards anything newly earned.
-- ---------------------------------------------------------------------------

create or replace function public.get_user_progress_stats(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_workouts integer;
  v_prs integer;
  v_streak integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select count(*)::integer into v_workouts
  from workout_sessions
  where user_id = v_user;

  select count(*)::integer into v_prs
  from exercises_logged e
  join workout_sessions s on s.id = e.session_id
  where s.user_id = v_user
    and e.is_pr;

  v_streak := current_workout_streak(v_user, p_today);

  -- Award on read. Idempotent, so calling it repeatedly is free.
  insert into user_badges (user_id, badge_key)
  select v_user, d.badge_key
  from badge_definitions d
  where case d.metric
          when 'streak' then v_streak
          when 'workouts' then v_workouts
          when 'prs' then v_prs
        end >= d.threshold
  on conflict (user_id, badge_key) do nothing;

  return jsonb_build_object(
    'workouts', v_workouts,
    'prs', v_prs,
    'streak_days', v_streak,
    'badges', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'badge_key', d.badge_key,
            'metric', d.metric,
            'threshold', d.threshold,
            'earned_at', b.earned_at
          )
          order by d.sort_order
        )
        from badge_definitions d
        left join user_badges b
          on b.badge_key = d.badge_key
         and b.user_id = v_user
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_user_progress_stats(date) from public;
grant execute on function public.get_user_progress_stats(date) to authenticated;

revoke all on function public.current_workout_streak(uuid, date) from public;
grant execute on function public.current_workout_streak(uuid, date) to authenticated;

grant select on public.badge_definitions to authenticated;
grant select on public.user_badges to authenticated;
