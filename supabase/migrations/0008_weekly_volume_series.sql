-- Weekly training volume, aggregated server-side.
--
-- Feeds the "You're trending up" nudge, which compares the last four weeks
-- against the four before and against every four-week stretch on record.
--
-- Why an RPC rather than a client query: volume lives in
-- `exercises_logged.set_lines` (JSONB), and the journal's paginated list query
-- deliberately omits that column because it is the expensive one. Pulling
-- months of set_lines over the wire to sum them in the browser is exactly the
-- cost that omission was avoiding. `exercise_volume_kg()` (migration 0007)
-- already encodes the tonnage rules, so the aggregate is one indexed pass.
--
-- The payload is the weekly series, not the finished verdict: rolling-window
-- arithmetic is easier to get right — and to unit-test — in TypeScript, and a
-- few hundred `{week_start, volume_kg}` rows is a few KB even after years of
-- logging. Only weeks that have data are returned; the client densifies the
-- gaps, because a week with no sessions must count as zero in a rolling sum
-- rather than being skipped over.
--
-- Weeks are ISO (Monday-start), matching `getWeekBoundsForDate` on the client.
-- `workout_sessions.date` is already the user's local calendar date, so there
-- is no timezone to reconcile here — unlike the streak, which needed `p_today`.

create or replace function public.get_weekly_volume_series()
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
      date_trunc('week', s.date)::date as week_start,
      public.exercise_volume_kg(e.exercise_type, e.set_lines, e.sets, e.reps, e.weight_kg) as volume
    from exercises_logged e
    join workout_sessions s on s.id = e.session_id
    where s.user_id = v_user
      and s.date is not null
  ),
  by_week as (
    select week_start, sum(volume) as volume
    from logged
    group by week_start
    -- A week of pure cardio has zero tonnage. Dropping it keeps the series to
    -- weeks that actually contribute, and the client treats absent weeks as
    -- zero anyway.
    having sum(volume) > 0
  )
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'week_start', to_char(week_start, 'YYYY-MM-DD'),
        'volume_kg', round(volume)
      ) order by week_start)
      from by_week
    ),
    '[]'::jsonb
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_weekly_volume_series() from public;
grant execute on function public.get_weekly_volume_series() to authenticated;
