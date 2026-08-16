-- Moves the strength-trend queries server-side.
--
-- The client previously fetched up to 60 sessions with their full `set_lines`
-- JSONB and derived the top set in TypeScript, keeping only the last 12 — a
-- reimplementation of `top_set_weight_kg`, which has existed here all along and
-- is what the PR-recompute triggers already use. Two copies of "what is the
-- heaviest set" is exactly the drift risk that function was added to remove.
--
-- Both follow `get_weekly_volume_series`: SECURITY DEFINER, scoped to auth.uid(),
-- returning jsonb so the client gets one shaped payload.

create or replace function public.get_exercise_trend(
  p_exercise_name text,
  p_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := (select auth.uid());
  v_limit integer := least(greatest(coalesce(p_limit, 12), 1), 60);
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  with per_session as (
    select
      s.date,
      -- One exercise can appear twice in a session (e.g. logged again later);
      -- the session's top set is the heaviest across all of them.
      max(public.top_set_weight_kg(e.set_lines, e.weight_kg)) as top_weight_kg,
      bool_or(coalesce(e.is_pr, false)) as is_pr
    from exercises_logged e
    join workout_sessions s on s.id = e.session_id
    where s.user_id = v_user
      and s.date is not null
      and e.exercise_name = p_exercise_name
    group by s.date
  ),
  -- Sessions with no weight at all (bodyweight, cardio) are dropped HERE rather
  -- than after transfer. That is what lets the limit below be exact: the client
  -- used to over-fetch 60 rows precisely because it could not know how many
  -- would survive this filter.
  weighted as (
    select date, top_weight_kg, is_pr
    from per_session
    where top_weight_kg is not null and top_weight_kg > 0
    order by date desc
    limit v_limit
  )
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'date', to_char(date, 'YYYY-MM-DD'),
        'top_weight_kg', top_weight_kg,
        'is_pr', is_pr
      ) order by date)          -- newest-first for the limit, oldest-first out
      from weighted
    ),
    '[]'::jsonb
  ) into v_result;

  return v_result;
end;
$function$;

create or replace function public.get_logged_exercises()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- Cardio is excluded because the trend chart plots top-set weight: listing a
  -- cardio exercise would offer a choice that can only render an empty chart.
  with counted as (
    select e.exercise_name as name, count(*) as logged_count
    from exercises_logged e
    join workout_sessions s on s.id = e.session_id
    where s.user_id = v_user
      and coalesce(e.exercise_type, '') <> 'cardio'
      and nullif(btrim(e.exercise_name), '') is not null
    group by e.exercise_name
  )
  select coalesce(
    (
      -- Most-logged first: the list is scanned, not searched, so the lifts the
      -- user actually tracks belong at the top. Name breaks ties for stability.
      select jsonb_agg(name order by logged_count desc, name asc)
      from counted
    ),
    '[]'::jsonb
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_exercise_trend(text, integer) from public, anon;
revoke all on function public.get_logged_exercises() from public, anon;
grant execute on function public.get_exercise_trend(text, integer) to authenticated;
grant execute on function public.get_logged_exercises() to authenticated;
