-- 0003_weekly_checkin_cron.sql
-- Weekly automation for the AI progress coach. A pg_cron job (Sunday 06:00 UTC) selects
-- users active in the last 30 days and, via pg_net, POSTs one request per user to the
-- generate-checkin edge function with the service-role key as bearer. generate-checkin is
-- idempotent per (user_id, generated_for_week), so re-runs and overlap never duplicate.
--
-- SECRETS: this migration references two Vault secrets BY NAME ONLY — it never contains
-- their values. Insert them once (out-of-band, not in git) before the first run:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/generate-checkin',
--                              'checkin_function_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'project_service_role_key');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Users with >=1 workout_session OR diet_log in the window. security definer so the
-- server-side dispatcher can read across all users; execute is revoked from clients.
create or replace function public.coach_active_user_ids(window_days int default 30)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select p.id
  from public.user_profiles p
  where exists (
          select 1 from public.workout_sessions w
          where w.user_id = p.id
            and w.date >= current_date - window_days
        )
     or exists (
          select 1 from public.diet_logs d
          where d.user_id = p.id
            and d.date >= current_date - window_days
        );
$$;

revoke all on function public.coach_active_user_ids(int) from public, anon, authenticated;

-- Dispatcher: read secrets from Vault, then queue one async POST per active user.
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
      body := jsonb_build_object('user_id', uid)
    );
  end loop;
end;
$$;

revoke all on function public.run_weekly_checkins() from public, anon, authenticated;

-- pg_net logs every request it dispatches -- including the service-role bearer token
-- run_weekly_checkins sends above -- into net.http_request_queue / net._http_response
-- (retained ~6 hours). anon/authenticated must not be able to read that schema, or a
-- client-side role could recover the service-role key and bypass RLS entirely. The
-- run_weekly_checkins dispatcher itself is security definer, owned by the
-- migration/superuser role, so it keeps calling net.http_post fine after these revokes.
revoke all on all tables in schema net from anon, authenticated;
revoke all on all routines in schema net from anon, authenticated;
revoke usage on schema net from anon, authenticated;

-- Every Sunday at 06:00 UTC. cron.schedule upserts by job name, so re-applying is safe.
select cron.schedule('weekly-checkin', '0 6 * * 0', $$ select public.run_weekly_checkins(); $$);
