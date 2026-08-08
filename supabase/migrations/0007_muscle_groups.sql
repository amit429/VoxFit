-- Muscle groups per logged exercise, so the Progress screen can show what was
-- trained this week and the all-time split by muscle.
--
-- DESIGN
--
-- Resolution is two-tier, cheapest first:
--   1. `exercise_muscle_map` — a GLOBAL lookup keyed on a normalized exercise
--      name. Seeded with common lifts, so the overwhelming majority of logs
--      resolve instantly, deterministically, and for free.
--   2. Anything the lookup misses is classified once by Gemini, asynchronously,
--      and the answer is written back into the same lookup. Because the lookup
--      is global rather than per-user, each unusual exercise costs exactly one
--      AI call for the whole product, ever.
--
-- Muscles are denormalized onto `exercises_logged` at write time by a trigger.
-- That is what makes the Progress queries plain aggregates over an indexed
-- column instead of a join-and-classify on every page view.
--
-- There is deliberately NO per-user rollup table. Both views (this week, and
-- all-time share) are GROUP BYs over that indexed column, which stays correct
-- when a session is edited or deleted. A rollup would have to be fully
-- recomputed per user on every edit — the same cost as just querying — while
-- adding a way for the numbers to go stale. The expensive part of this feature
-- is the AI classification, and that IS cached, permanently.
--
-- The AI call never blocks a log: the trigger queues it through pg_net and
-- returns immediately. Rows sit with a null muscle until the callback lands,
-- and the UI reports how many are still pending rather than pretending.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- 1. The vocabulary
--
-- A domain rather than a per-column check: three places need the same list, and
-- a domain keeps it in one. `other` is the required escape hatch — a model
-- returning something unexpected must land somewhere valid, never break a log.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'muscle_group') then
    create domain public.muscle_group as text
      check (value in ('chest','back','legs','glutes','shoulders','arms','core','cardio','other'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Name normalization
--
-- "Barbell Squat", "barbell  squat", and "Barbell Squats!" must be one key, or
-- the cache misses constantly and every phrasing costs an AI call. Trailing
-- plurals are stripped for the same reason.
-- ---------------------------------------------------------------------------

create or replace function public.normalize_exercise_key(p_name text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9 ]', ' ', 'g'),
        '\s+', ' ', 'g'
      ),
      '(\w)s$', '\1'
    ),
    ''
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. The lookup
-- ---------------------------------------------------------------------------

create table if not exists public.exercise_muscle_map (
  exercise_key text primary key,
  primary_muscle public.muscle_group not null,
  secondary_muscle public.muscle_group,
  -- 'seed' rows are curated here; 'ai' rows were classified at runtime.
  source text not null default 'seed' check (source in ('seed', 'ai')),
  created_at timestamptz not null default now()
);

alter table public.exercise_muscle_map enable row level security;

-- Readable by any signed-in user: it is a shared dictionary, not user data.
-- No write policy — only the security-definer trigger and the service role
-- (from the classifier function) write here.
drop policy if exists exercise_muscle_map_select_all on public.exercise_muscle_map;
create policy exercise_muscle_map_select_all
  on public.exercise_muscle_map
  for select
  to authenticated
  using (true);

-- Seed. Keys must already be normalized, so they are written through the
-- normalizer rather than by hand.
insert into public.exercise_muscle_map (exercise_key, primary_muscle, secondary_muscle, source)
select public.normalize_exercise_key(name), primary_muscle, secondary_muscle, 'seed'
from (values
  -- Chest
  ('Bench Press', 'chest', 'arms'),
  ('Barbell Bench Press', 'chest', 'arms'),
  ('Incline Bench Press', 'chest', 'shoulders'),
  ('Incline Dumbbell Press', 'chest', 'shoulders'),
  ('Decline Bench Press', 'chest', 'arms'),
  ('Flat Dumbbell Press', 'chest', 'arms'),
  ('Dumbbell Press', 'chest', 'arms'),
  ('Chest Press', 'chest', 'arms'),
  ('Push Up', 'chest', 'arms'),
  ('Pec Deck Fly', 'chest', null),
  ('Chest Fly', 'chest', null),
  ('Cable Fly', 'chest', null),
  ('Dumbbell Fly', 'chest', null),
  ('Dip', 'chest', 'arms'),
  -- Back
  ('Deadlift', 'back', 'legs'),
  ('Barbell Row', 'back', 'arms'),
  ('Bent Over Row', 'back', 'arms'),
  ('Dumbbell Row', 'back', 'arms'),
  ('Seated Cable Row', 'back', 'arms'),
  ('Cable Row', 'back', 'arms'),
  ('Lat Pulldown', 'back', 'arms'),
  ('Pull Up', 'back', 'arms'),
  ('Chin Up', 'back', 'arms'),
  ('T Bar Row', 'back', 'arms'),
  ('Face Pull', 'back', 'shoulders'),
  ('Shrug', 'back', 'shoulders'),
  ('Straight Arm Pulldown', 'back', null),
  -- Legs
  ('Squat', 'legs', 'glutes'),
  ('Barbell Squat', 'legs', 'glutes'),
  ('Back Squat', 'legs', 'glutes'),
  ('Front Squat', 'legs', 'core'),
  ('Leg Press', 'legs', 'glutes'),
  ('Leg Extension', 'legs', null),
  ('Leg Curl', 'legs', null),
  ('Hamstring Curl', 'legs', null),
  ('Lunge', 'legs', 'glutes'),
  ('Walking Lunge', 'legs', 'glutes'),
  ('Bulgarian Split Squat', 'legs', 'glutes'),
  ('Split Squat', 'legs', 'glutes'),
  ('Goblet Squat', 'legs', 'glutes'),
  ('Calf Raise', 'legs', null),
  ('Step Up', 'legs', 'glutes'),
  -- Glutes
  ('Romanian Deadlift', 'glutes', 'legs'),
  ('Hip Thrust', 'glutes', 'legs'),
  ('Glute Bridge', 'glutes', 'legs'),
  ('Cable Kickback', 'glutes', null),
  ('Hip Abduction', 'glutes', null),
  -- Shoulders
  ('Overhead Press', 'shoulders', 'arms'),
  ('Shoulder Press', 'shoulders', 'arms'),
  ('Military Press', 'shoulders', 'arms'),
  ('Arnold Press', 'shoulders', 'arms'),
  ('Lateral Raise', 'shoulders', null),
  ('Side Lateral Raise', 'shoulders', null),
  ('Front Raise', 'shoulders', null),
  ('Rear Delt Fly', 'shoulders', 'back'),
  ('Upright Row', 'shoulders', 'back'),
  -- Arms
  ('Bicep Curl', 'arms', null),
  ('Barbell Curl', 'arms', null),
  ('Dumbbell Curl', 'arms', null),
  ('Hammer Curl', 'arms', null),
  ('Preacher Curl', 'arms', null),
  ('Concentration Curl', 'arms', null),
  ('Tricep Pushdown', 'arms', null),
  ('Triceps Pushdown', 'arms', null),
  ('Tricep Extension', 'arms', null),
  ('Skull Crusher', 'arms', null),
  ('Close Grip Bench Press', 'arms', 'chest'),
  ('Wrist Curl', 'arms', null),
  -- Core
  ('Plank', 'core', null),
  ('Crunch', 'core', null),
  ('Sit Up', 'core', null),
  ('Leg Raise', 'core', null),
  ('Hanging Leg Raise', 'core', null),
  ('Russian Twist', 'core', null),
  ('Cable Crunch', 'core', null),
  ('Ab Wheel Rollout', 'core', null),
  ('Mountain Climber', 'core', 'cardio'),
  ('Dead Bug', 'core', null),
  -- Cardio
  ('Running', 'cardio', null),
  ('Treadmill', 'cardio', null),
  ('Cycling', 'cardio', null),
  ('Stationary Bike', 'cardio', null),
  ('Rowing', 'cardio', null),
  ('Elliptical', 'cardio', null),
  ('Stair Climber', 'cardio', null),
  ('Jump Rope', 'cardio', null),
  ('Swimming', 'cardio', null),
  ('Walking', 'cardio', null),
  ('Burpee', 'cardio', 'legs'),
  ('HIIT', 'cardio', null),
  ('LISS Cardio', 'cardio', null)
) as seed(name, primary_muscle, secondary_muscle)
on conflict (exercise_key) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Denormalized columns + resolution trigger
-- ---------------------------------------------------------------------------

alter table public.exercises_logged
  add column if not exists primary_muscle public.muscle_group,
  add column if not exists secondary_muscle public.muscle_group;

comment on column public.exercises_logged.primary_muscle is
  'Resolved from exercise_muscle_map at write time. Null means not yet classified.';

-- Cardio is known from the row itself, so it never needs the lookup or the AI.
create or replace function public.resolve_exercise_muscles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := public.normalize_exercise_key(new.exercise_name);
  v_primary public.muscle_group;
  v_secondary public.muscle_group;
begin
  select m.primary_muscle, m.secondary_muscle
    into v_primary, v_secondary
  from public.exercise_muscle_map m
  where m.exercise_key = v_key;

  if v_primary is not null then
    new.primary_muscle := v_primary;
    new.secondary_muscle := v_secondary;
  elsif new.exercise_type = 'cardio' then
    new.primary_muscle := 'cardio';
    new.secondary_muscle := null;
  else
    -- Left null on purpose: the async classifier fills it, and the UI counts
    -- what is still pending rather than guessing.
    new.primary_muscle := null;
    new.secondary_muscle := null;
  end if;

  return new;
end;
$$;

drop trigger if exists exercises_logged_resolve_muscles on public.exercises_logged;
create trigger exercises_logged_resolve_muscles
  before insert or update of exercise_name on public.exercises_logged
  for each row
  execute function public.resolve_exercise_muscles();

create index if not exists exercises_logged_primary_muscle_idx
  on public.exercises_logged (primary_muscle)
  where primary_muscle is not null;

-- Unclassified rows are looked up by name by the classifier's backfill.
create index if not exists exercises_logged_unclassified_idx
  on public.exercises_logged (exercise_name)
  where primary_muscle is null;

-- ---------------------------------------------------------------------------
-- 5. Async classification dispatch
--
-- Statement-level with a transition table so one multi-exercise session fires
-- ONE request, not one per exercise. Fire-and-forget through pg_net: the insert
-- commits immediately and the user is never waiting on Gemini.
--
-- The classifier URL is derived from the existing checkin secret so no new
-- out-of-band secret insert is needed; a dedicated
-- `classify_muscles_function_url` secret takes precedence if one is added.
-- ---------------------------------------------------------------------------

create or replace function public.dispatch_muscle_classification()
returns trigger
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  v_names text[];
  v_url text;
  v_key text;
begin
  select array_agg(distinct n.exercise_name)
    into v_names
  from new_rows n
  where n.primary_muscle is null
    and coalesce(n.exercise_name, '') <> '';

  if v_names is null or array_length(v_names, 1) = 0 then
    return null;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'classify_muscles_function_url';

  if v_url is null then
    select replace(decrypted_secret, '/generate-checkin', '/classify-exercise-muscles')
      into v_url
      from vault.decrypted_secrets where name = 'checkin_function_url';
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'project_service_role_key';

  -- Missing secrets must not fail the workout write. The rows stay unclassified
  -- and the next log (or a manual sweep) retries.
  if v_url is null or v_key is null then
    raise warning 'dispatch_muscle_classification: missing Vault secrets, skipping';
    return null;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('exercise_names', to_jsonb(v_names)),
    timeout_milliseconds := 60000
  );

  return null;
end;
$$;

revoke all on function public.dispatch_muscle_classification() from public, anon, authenticated;

drop trigger if exists exercises_logged_dispatch_classification on public.exercises_logged;
create trigger exercises_logged_dispatch_classification
  after insert on public.exercises_logged
  referencing new table as new_rows
  for each statement
  execute function public.dispatch_muscle_classification();

-- ---------------------------------------------------------------------------
-- 6. Volume in SQL
--
-- Mirrors exerciseStrengthVolumeKg / repsForLine in workout-display.util.ts,
-- including the deliberate 1-rep floor when reps were never spoken: crediting
-- the logged weight beats discarding real work. Cardio contributes 0 — there is
-- no tonnage to compare against a lift.
-- ---------------------------------------------------------------------------

create or replace function public.exercise_volume_kg(
  p_exercise_type text,
  p_set_lines jsonb,
  p_sets integer,
  p_reps integer,
  p_weight numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_exercise_type = 'cardio' then 0
    when jsonb_typeof(p_set_lines) = 'array' and jsonb_array_length(p_set_lines) > 0 then (
      select coalesce(sum(
        coalesce((l->>'sets')::numeric, 0)
        * case
            when (l->>'reps') is not null then (l->>'reps')::numeric
            when (l->>'reps_min') is not null and (l->>'reps_max') is not null
              then ((l->>'reps_min')::numeric + (l->>'reps_max')::numeric) / 2
            when (l->>'reps_min') is not null then (l->>'reps_min')::numeric
            when (l->>'reps_max') is not null then (l->>'reps_max')::numeric
            else 1
          end
        * coalesce((l->>'weight_kg')::numeric, 0)
      ), 0)
      from jsonb_array_elements(p_set_lines) l
    )
    else coalesce(p_sets, 0) * coalesce(p_reps, 0) * coalesce(p_weight, 0)
  end;
$$;

-- ---------------------------------------------------------------------------
-- 7. The read API
--
-- One call for both views. `p_week_start`/`p_week_end` come from the client so
-- the week matches the user's own Monday, not the server's timezone.
-- ---------------------------------------------------------------------------

create or replace function public.get_muscle_breakdown(p_week_start date, p_week_end date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  with logged as (
    select
      e.primary_muscle,
      s.date,
      s.id as session_id,
      public.exercise_volume_kg(e.exercise_type, e.set_lines, e.sets, e.reps, e.weight_kg) as volume
    from exercises_logged e
    join workout_sessions s on s.id = e.session_id
    where s.user_id = v_user
  ),
  this_week as (
    select primary_muscle, sum(volume) as volume, count(distinct session_id) as sessions
    from logged
    where primary_muscle is not null
      and date between p_week_start and p_week_end
    group by primary_muscle
  ),
  overall as (
    select primary_muscle, sum(volume) as volume
    from logged
    where primary_muscle is not null
    group by primary_muscle
  ),
  overall_total as (
    -- Cardio has no tonnage, so including it would make every share read low.
    select nullif(sum(volume), 0) as total
    from overall
    where primary_muscle <> 'cardio'
  )
  select jsonb_build_object(
    'week', coalesce((
      select jsonb_agg(jsonb_build_object(
        'muscle', primary_muscle,
        'volume_kg', round(volume),
        'sessions', sessions
      ) order by volume desc)
      from this_week
    ), '[]'::jsonb),
    'overall', coalesce((
      select jsonb_agg(jsonb_build_object(
        'muscle', o.primary_muscle,
        'volume_kg', round(o.volume),
        'share_pct', case
          when o.primary_muscle = 'cardio' or (select total from overall_total) is null then 0
          else round(o.volume * 100.0 / (select total from overall_total))
        end
      ) order by o.volume desc)
      from overall o
      where o.primary_muscle <> 'cardio'
    ), '[]'::jsonb),
    'week_sessions', (
      select count(distinct id) from workout_sessions
      where user_id = v_user and date between p_week_start and p_week_end
    ),
    -- Surfaced so the UI can say "still working some out" instead of quietly
    -- under-reporting while classification is in flight.
    'pending', (
      select count(*)
      from exercises_logged e
      join workout_sessions s on s.id = e.session_id
      where s.user_id = v_user and e.primary_muscle is null
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_muscle_breakdown(date, date) from public;
grant execute on function public.get_muscle_breakdown(date, date) to authenticated;

grant select on public.exercise_muscle_map to authenticated;
grant select, insert, update on public.exercise_muscle_map to service_role;
grant select, update on public.exercises_logged to service_role;

-- ---------------------------------------------------------------------------
-- 8. Backfill existing rows through the same path the trigger uses
-- ---------------------------------------------------------------------------

update public.exercises_logged e
set primary_muscle = m.primary_muscle,
    secondary_muscle = m.secondary_muscle
from public.exercise_muscle_map m
where m.exercise_key = public.normalize_exercise_key(e.exercise_name)
  and e.primary_muscle is null;

update public.exercises_logged
set primary_muscle = 'cardio'
where primary_muscle is null
  and exercise_type = 'cardio';

-- ---------------------------------------------------------------------------
-- 9. Helpers the classify-exercise-muscles edge function calls
--
-- Both exist so the function never reimplements normalization: the trigger, the
-- backfill and the cache lookup must agree on what "the same exercise" means,
-- and that logic lives in normalize_exercise_key only.
-- ---------------------------------------------------------------------------

create or replace function public.normalize_exercise_keys(p_names text[])
returns table (name text, exercise_key text)
language sql
stable
security definer
set search_path = public
as $$
  select n as name, public.normalize_exercise_key(n) as exercise_key
  from unnest(coalesce(p_names, array[]::text[])) as n;
$$;

revoke all on function public.normalize_exercise_keys(text[]) from public, anon, authenticated;
grant execute on function public.normalize_exercise_keys(text[]) to service_role;

create or replace function public.backfill_exercise_muscles(p_names text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[];
  v_updated integer;
begin
  select array_agg(distinct public.normalize_exercise_key(n))
    into v_keys
  from unnest(coalesce(p_names, array[]::text[])) as n;

  if v_keys is null then
    return 0;
  end if;

  update public.exercises_logged e
  set primary_muscle = m.primary_muscle,
      secondary_muscle = m.secondary_muscle
  from public.exercise_muscle_map m
  where m.exercise_key = public.normalize_exercise_key(e.exercise_name)
    and m.exercise_key = any(v_keys)
    and e.primary_muscle is null;

  get diagnostics v_updated = row_count;
  return coalesce(v_updated, 0);
end;
$$;

revoke all on function public.backfill_exercise_muscles(text[]) from public, anon, authenticated;
grant execute on function public.backfill_exercise_muscles(text[]) to service_role;

-- ---------------------------------------------------------------------------
-- 10. Hardening (advisor follow-up)
--
-- resolve_exercise_muscles is a TRIGGER function, but PostgREST exposed it at
-- /rest/v1/rpc/resolve_exercise_muscles to anon and authenticated. Calling it
-- outside a trigger errors, so it was not exploitable — but an endpoint nobody
-- should ever hit should not exist.
--
-- normalize_exercise_key and exercise_volume_kg are pure and reference no
-- tables, so a mutable search_path was not exploitable either; pinning it is
-- standard hardening that costs nothing. Both are recreated above with
-- `set search_path = ''` in the live schema — see migration
-- `muscle_function_hardening`.
-- ---------------------------------------------------------------------------

revoke all on function public.resolve_exercise_muscles() from public, anon, authenticated;
revoke all on function public.dispatch_muscle_classification() from public, anon, authenticated;

alter function public.normalize_exercise_key(text) set search_path = '';
alter function public.exercise_volume_kg(text, jsonb, integer, integer, numeric) set search_path = '';
