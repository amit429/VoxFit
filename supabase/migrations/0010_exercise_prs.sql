-- Automatic personal-record detection for strength exercises.
--
-- DESIGN
--
-- A PR is the heaviest top-set weight ever logged for an exercise, by that
-- user. Unlike the muscle classification in 0007, none of this needs an AI
-- call -- it is an indexed query over the user's own rows -- so the work runs
-- synchronously inside the writing transaction and the flag is already correct
-- when the review screen reads the row back. No pg_net, no cron, no async gap.
--
-- Two sources can set is_pr and they must not fight:
--   'declared' -- the user said so out loud (the extractor) or ticked the box
--                 in the exercise editor. Never overwritten by detection.
--   'detected' -- worked out here, by comparing against history.
--
-- Correctness under edits comes from recompute_exercise_prs() being a full
-- replay rather than an incremental update: it is idempotent, so the insert
-- trigger, the delete trigger and the backfill can all just call it. That is
-- why there is no reconciliation cron -- there is no window of staleness for
-- one to repair.

-- ---------------------------------------------------------------------------
-- 1. Canonical exercise identity
--
-- normalize_exercise_key() (0007) already folds case, punctuation and trailing
-- plurals, so "Push-ups" and "Push Ups" are one key for free. This table only
-- has to carry genuine synonyms that survive that folding.
--
-- Global rather than per-user, same reasoning as exercise_muscle_map: naming
-- drift is a property of the language, not of one person's log.
-- ---------------------------------------------------------------------------

create table if not exists public.exercise_alias_map (
  alias_key     text primary key,
  canonical_key text not null,
  -- 'seed' rows are curated below. 'ai' is reserved for a future classifier
  -- tier; nothing writes it today.
  source        text not null default 'seed' check (source in ('seed', 'ai')),
  created_at    timestamptz not null default now()
);

alter table public.exercise_alias_map enable row level security;

-- A shared dictionary, not user data. No write policy: seeds ship in
-- migrations, and only security-definer functions would ever write more.
drop policy if exists exercise_alias_map_select_all on public.exercise_alias_map;
create policy exercise_alias_map_select_all
  on public.exercise_alias_map
  for select
  to authenticated
  using (true);

-- Both sides go through the normalizer rather than being written pre-folded,
-- so the seed cannot drift from the function that reads it.
--
-- DELIBERATELY ABSENT: equipment variants. "Bench Press", "Dumbbell Flat Bench
-- Press" and "Chest Press" stay three separate records. A per-hand dumbbell
-- weight and a barbell total are not comparable -- merging them invents PRs in
-- one direction and creates permanently unbeatable records in the other.
-- "Pec Deck Fly" is excluded from the fly group for exactly that reason.
insert into public.exercise_alias_map (alias_key, canonical_key, source)
select public.normalize_exercise_key(a.alias),
       public.normalize_exercise_key(a.canonical),
       'seed'
from (values
  ('Pec Fly',     'Chest Fly'),
  ('Chest Flies', 'Chest Fly'),
  ('Flyes',       'Chest Fly'),
  ('Bench Fly',   'Chest Fly')
) as a(alias, canonical)
on conflict (alias_key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------

-- STABLE, not IMMUTABLE: it reads exercise_alias_map, so its answer changes
-- when an alias is added. Marking it immutable to make it index-legal would
-- produce a silently stale index the first time that happened -- which is why
-- the index below is on normalize_exercise_key() instead.
create or replace function public.canonical_exercise_key(p_name text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select m.canonical_key
       from public.exercise_alias_map m
      where m.alias_key = public.normalize_exercise_key(p_name)),
    public.normalize_exercise_key(p_name)
  );
$$;

-- The heaviest weight in a row's set_lines -- "top set". Derived here rather
-- than trusting exercises_logged.weight_kg, which is computed client-side
-- (workout-session-log.service.ts legacyColumnsFromExercise). The column is
-- the fallback when set_lines carries no usable weight.
--
-- Returns null for anything non-positive so bodyweight and cardio rows are
-- simply not eligible, rather than competing at 0 kg.
create or replace function public.top_set_weight_kg(p_set_lines jsonb, p_weight_kg numeric)
returns numeric
language sql
immutable
as $$
  select case when w > 0 then w else null end
  from (
    select coalesce(
      (
        select max((l ->> 'weight_kg')::numeric)
        from jsonb_array_elements(
               case when jsonb_typeof(p_set_lines) = 'array'
                    then p_set_lines
                    else '[]'::jsonb
               end
             ) as l
        where (l ->> 'weight_kg') ~ '^[0-9]+(\.[0-9]+)?$'
      ),
      p_weight_kg
    ) as w
  ) t;
$$;

-- ---------------------------------------------------------------------------
-- 3. Where the answer lands
-- ---------------------------------------------------------------------------

alter table public.exercises_logged
  add column if not exists pr_source text
    check (pr_source in ('declared', 'detected'));

comment on column public.exercises_logged.pr_source is
  'Null when not a PR. declared = the user claimed it; detection never touches those. detected = derived by recompute_exercise_prs().';

-- normalize_exercise_key() is genuinely immutable (pure string manipulation),
-- so it is legal and safe in an index expression. recompute_exercise_prs()
-- matches on this expression and expands aliases in the WHERE, which keeps the
-- index usable while leaving the alias map free to change.
create index if not exists exercises_logged_normalized_name_idx
  on public.exercises_logged (public.normalize_exercise_key(exercise_name))
  where exercise_type = 'strength';

-- ---------------------------------------------------------------------------
-- 4. The engine
--
-- Replays one user's entire history for one canonical exercise and rewrites
-- its detected flags. A full replay rather than an incremental update, which
-- is what makes it idempotent -- and therefore what lets the insert trigger,
-- the delete trigger and the backfill all be the same one call.
--
-- Declared rows are read as history (they advance the running max) but are
-- never written. Rows with no usable weight neither PR nor advance the max:
-- max() ignores nulls, so that falls out of the window function for free.
-- ---------------------------------------------------------------------------

create or replace function public.recompute_exercise_prs(p_user_id uuid, p_canonical_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[];
begin
  if p_user_id is null or coalesce(p_canonical_key, '') = '' then
    return;
  end if;

  -- Every normalized key that canonicalizes to this one: the canonical itself,
  -- plus its aliases. Matching on the normalized key (not the canonical) is
  -- what lets the partial index do the work.
  select array_agg(k) into v_keys
  from (
    select p_canonical_key as k
    union
    select m.alias_key from public.exercise_alias_map m
     where m.canonical_key = p_canonical_key
  ) s;

  with ordered as (
    select e.id,
           public.top_set_weight_kg(e.set_lines, e.weight_kg) as w,
           -- date first, created_at to break ties inside one day, id as a
           -- final deterministic tiebreak. NULLS LAST so an undated session
           -- cannot pose as the earliest and suppress a real PR.
           row_number() over (order by s.date nulls last, e.created_at, e.id) as rn
      from public.exercises_logged e
      join public.workout_sessions s on s.id = e.session_id
     where s.user_id = p_user_id
       and e.exercise_type = 'strength'
       and public.normalize_exercise_key(e.exercise_name) = any(v_keys)
  ),
  running as (
    select id,
           w,
           max(w) over (
             order by rn
             rows between unbounded preceding and 1 preceding
           ) as prev_max
      from ordered
  )
  update public.exercises_logged e
     set is_pr    = (r.w is not null and r.prev_max is not null and r.w > r.prev_max),
         pr_source = case
                       when r.w is not null and r.prev_max is not null and r.w > r.prev_max
                       then 'detected'
                       else null
                     end
    from running r
   where e.id = r.id
     -- The whole promise of pr_source: a spoken claim is never rewritten.
     and e.pr_source is distinct from 'declared';
end;
$$;

-- SECURITY DEFINER with a user_id parameter: without this revoke, any signed-in
-- user could invoke it for someone else's id. Only the triggers (which run as
-- definer themselves) and the migration's backfill need it.
revoke all on function public.recompute_exercise_prs(uuid, text) from public;
revoke all on function public.recompute_exercise_prs(uuid, text) from anon;
revoke all on function public.recompute_exercise_prs(uuid, text) from authenticated;

-- ---------------------------------------------------------------------------
-- 5. Denormalized owner
--
-- LOAD-BEARING, not an optimization. exercises_logged_session_id_fkey is
-- ON DELETE CASCADE: deleting a session removes its exercises, and by the time
-- the AFTER DELETE statement trigger runs, the parent workout_sessions row is
-- already gone. A trigger that resolved the owner by joining back to that
-- parent would therefore match nothing and silently skip the recompute --
-- leaving stale PR flags across the user's SURVIVING sessions for the same
-- exercise. Reading the owner off the deleted row itself is the fix.
-- ---------------------------------------------------------------------------

alter table public.exercises_logged
  add column if not exists user_id uuid references public.user_profiles(id);

comment on column public.exercises_logged.user_id is
  'Denormalized from workout_sessions.user_id. Load-bearing for the AFTER DELETE PR trigger: the session FK cascades, so the parent is already gone when that trigger runs.';

-- Backfill before anything depends on it. Nullable on purpose so this can run
-- after the column is added rather than needing a default.
update public.exercises_logged e
   set user_id = s.user_id
  from public.workout_sessions s
 where s.id = e.session_id
   and e.user_id is null;

create index if not exists exercises_logged_user_id_idx
  on public.exercises_logged (user_id);

-- ---------------------------------------------------------------------------
-- 6. Row preparation
--
-- pr_source is set by the CLIENT, not stamped from is_pr here. Only the client
-- can tell a fresh claim from a flag this feature wrote earlier: it sends
--   pr_source: ex.is_pr ? (ex.pr_source ?? 'declared') : null
-- so an edit round-trip returns 'detected' as 'detected' and it stays
-- recomputable. An earlier design stamped 'declared' whenever is_pr arrived
-- true, which laundered every detected PR into a permanent one the first time
-- a session was edited.
--
-- What IS enforced here is that the combination is coherent. A row with
-- is_pr = false must never carry a pr_source: the engine skips anything marked
-- 'declared', so such a row could never be flagged again.
-- ---------------------------------------------------------------------------

create or replace function public.prepare_exercise_pr_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is null then
    select s.user_id
      into new.user_id
      from public.workout_sessions s
     where s.id = new.session_id;
  end if;

  new.pr_source := case
                     when new.is_pr then coalesce(new.pr_source, 'declared')
                     else null
                   end;

  return new;
end;
$$;

drop trigger if exists exercises_logged_prepare_pr_row on public.exercises_logged;
create trigger exercises_logged_prepare_pr_row
  before insert on public.exercises_logged
  for each row
  execute function public.prepare_exercise_pr_row();

-- ---------------------------------------------------------------------------
-- 7. Keeping flags correct
--
-- Statement-level with transition tables so a six-exercise session does one
-- pass per distinct exercise, not one per row -- the same reasoning as 0007's
-- dispatch trigger.
--
-- replaceSessionExercises() is delete-then-insert, so an edit fires both of
-- these and converges without any UPDATE path needing to exist.
--
-- KNOWN LIMITATION: there is no UPDATE trigger, though `authenticated` holds a
-- table-wide UPDATE grant. The current client never calls .update() on this
-- table (insert and delete only), so nothing desyncs today. The first feature
-- that edits a set in place must add an UPDATE trigger here, or call
-- recompute_exercise_prs() itself.
-- ---------------------------------------------------------------------------

create or replace function public.recompute_prs_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.recompute_exercise_prs(q.user_id, q.ck)
     from (select distinct n.user_id,
                  public.canonical_exercise_key(n.exercise_name) as ck
             from new_rows n
            where n.exercise_type = 'strength'
              and n.user_id is not null) q;
  return null;
end;
$$;

create or replace function public.recompute_prs_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Reads user_id off the deleted row. Deliberately does NOT join to
  -- workout_sessions: see section 5 -- on a cascading session delete that
  -- parent no longer exists and the join would drop every row.
  perform public.recompute_exercise_prs(q.user_id, q.ck)
     from (select distinct o.user_id,
                  public.canonical_exercise_key(o.exercise_name) as ck
             from old_rows o
            where o.exercise_type = 'strength'
              and o.user_id is not null) q;
  return null;
end;
$$;

drop trigger if exists exercises_logged_recompute_prs_ins on public.exercises_logged;
create trigger exercises_logged_recompute_prs_ins
  after insert on public.exercises_logged
  referencing new table as new_rows
  for each statement
  execute function public.recompute_prs_after_insert();

drop trigger if exists exercises_logged_recompute_prs_del on public.exercises_logged;
create trigger exercises_logged_recompute_prs_del
  after delete on public.exercises_logged
  referencing old table as old_rows
  for each statement
  execute function public.recompute_prs_after_delete();

-- Same rule already stated for recompute_exercise_prs: these are SECURITY
-- DEFINER, so nothing outside the trigger machinery should be able to call
-- them. plpgsql rejects a direct call to a trigger function anyway; this makes
-- the intent explicit rather than relying on that.
revoke all on function public.prepare_exercise_pr_row() from public, anon, authenticated;
revoke all on function public.recompute_prs_after_insert() from public, anon, authenticated;
revoke all on function public.recompute_prs_after_delete() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Backfill
--
-- Existing is_pr=true rows were set by the extractor from a spoken claim,
-- which is exactly what 'declared' means -- so they are stamped before the
-- recompute runs, and the recompute then leaves them alone.
-- ---------------------------------------------------------------------------

update public.exercises_logged
   set pr_source = 'declared'
 where is_pr is true
   and pr_source is null;

do $$
declare
  r record;
begin
  for r in
    select distinct s.user_id, public.canonical_exercise_key(e.exercise_name) as ck
      from public.exercises_logged e
      join public.workout_sessions s on s.id = e.session_id
     where e.exercise_type = 'strength'
  loop
    perform public.recompute_exercise_prs(r.user_id, r.ck);
  end loop;
end $$;
