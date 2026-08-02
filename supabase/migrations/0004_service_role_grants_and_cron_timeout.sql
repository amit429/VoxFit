-- 0004_service_role_grants_and_cron_timeout.sql
-- Two fixes surfaced by the first live weekly-checkin E2E:
--
-- (1) service_role table grants. The weekly cron invokes generate-checkin as the
--     service_role Postgres role (the bearer equals the auto-injected service key). On this
--     project service_role held NO grants on the coach tables, so the agent's reads and the
--     review/nudge writes failed with "permission denied for table ...". service_role is
--     server-only and bypasses RLS, so granting it exactly what the cron touches is the
--     standard, safe fix. (Historically only anon/authenticated were granted here.)
--
-- (2) pg_net timeout. The agent runs ~10-15s but pg_net's default timeout is 5s, so the
--     dispatcher gave up before the response and net._http_response logged a timeout even
--     though the edge function completed and wrote the row. A generous timeout makes the
--     weekly run observable (real 200 captured) and removes any dependency on the function
--     surviving a client disconnect.

grant select on
  public.workout_sessions, public.exercises_logged, public.user_profiles,
  public.diet_logs, public.workout_plans
  to service_role;
grant select, insert, update on
  public.progress_reviews, public.plan_nudges
  to service_role;

-- Recreate the dispatcher with an explicit, generous per-request timeout.
create or replace function public.run_weekly_checkins()
returns void
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  fn_url text;
  service_key text;
  uid uuid;
begin
  select decrypted_secret into fn_url
    from vault.decrypted_secrets where name = 'checkin_function_url';
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'project_service_role_key';
  if fn_url is null or service_key is null then
    raise exception 'run_weekly_checkins: missing Vault secrets checkin_function_url / project_service_role_key';
  end if;

  for uid in select public.coach_active_user_ids(30) loop
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('user_id', uid),
      timeout_milliseconds := 60000
    );
  end loop;
end;
$$;

revoke all on function public.run_weekly_checkins() from public, anon, authenticated;
