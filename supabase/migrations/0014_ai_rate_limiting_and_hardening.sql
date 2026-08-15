-- 0014_ai_rate_limiting_and_hardening.sql
--
-- Pre-launch security hardening, three parts:
--   1. Per-user quota accounting for the Gemini-backed edge functions. Until now
--      any signed-in account could call them in a loop; the only ceiling was the
--      Google billing account.
--   2. Close the anonymous user-enumeration hole on `email_exists`.
--   3. Pin the one function still carrying a mutable search_path.

-- ---------------------------------------------------------------------------
-- 1. AI quota accounting
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now()
);

comment on table public.ai_usage_events is
  'One row per accepted AI edge-function call, written by consume_ai_quota(). Rows older than 24h are pruned opportunistically on each call — this is a rolling window, not an audit log.';

-- Supports both window queries in consume_ai_quota (per-endpoint hourly, all-endpoint daily).
create index if not exists ai_usage_events_user_endpoint_time_idx
  on public.ai_usage_events (user_id, endpoint, created_at desc);
create index if not exists ai_usage_events_user_time_idx
  on public.ai_usage_events (user_id, created_at desc);

-- RLS on with NO policies: this table is reachable only through the
-- SECURITY DEFINER function below (and service_role, which bypasses RLS).
-- A user must not be able to read, forge, or delete their own usage rows —
-- deleting them would reset their own limit.
alter table public.ai_usage_events enable row level security;

/**
 * Atomically check-and-consume one unit of a user's AI quota.
 *
 * Returns jsonb: { allowed: bool, reason?: text, retry_after?: int, ... }.
 * Never raises on denial — the caller turns `allowed:false` into a 429, and an
 * exception here would be indistinguishable from a real outage.
 *
 * The per-user transaction-level advisory lock makes the count→insert pair
 * atomic. Without it two concurrent requests both read the pre-insert count and
 * both pass, which is exactly the pattern an abuser hits when they fire
 * parallel requests rather than sequential ones.
 */
create or replace function public.consume_ai_quota(
  p_endpoint text,
  p_per_hour integer default 20,
  p_per_day integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_hour integer;
  v_day integer;
begin
  if v_user is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;

  -- Serialise this user's quota check against itself; different users never contend.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  -- Opportunistic prune. Bounded by one user's own rows, so it stays cheap and
  -- removes the need for a separate cron job to keep this table from growing.
  delete from public.ai_usage_events
   where user_id = v_user
     and created_at < now() - interval '24 hours';

  select count(*) into v_hour
    from public.ai_usage_events
   where user_id = v_user
     and endpoint = p_endpoint
     and created_at > now() - interval '1 hour';

  if v_hour >= p_per_hour then
    return jsonb_build_object('allowed', false, 'reason', 'hourly_limit', 'retry_after', 3600);
  end if;

  select count(*) into v_day
    from public.ai_usage_events
   where user_id = v_user
     and created_at > now() - interval '24 hours';

  if v_day >= p_per_day then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'retry_after', 86400);
  end if;

  insert into public.ai_usage_events (user_id, endpoint) values (v_user, p_endpoint);

  return jsonb_build_object(
    'allowed', true,
    'hour_count', v_hour + 1,
    'day_count', v_day + 1
  );
end;
$$;

revoke all on function public.consume_ai_quota(text, integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. email_exists — remove anonymous access (user enumeration)
-- ---------------------------------------------------------------------------
--
-- Granting this to `anon` let anyone with the public anon key ask "does this
-- address have a VoxFit account" for any address, at any rate — a membership
-- oracle over the whole user table, and for a fitness app that is exactly the
-- kind of inference people don't consent to. The registration form's
-- "already registered" hint is not worth that; AuthService now falls back to
-- the post-submit signUp response, which reveals the same fact only to someone
-- who actually attempted a registration for that address.
-- REVOKE FROM PUBLIC IS THE LOAD-BEARING LINE. Postgres grants EXECUTE to the
-- PUBLIC pseudo-role on every function at creation time, and `anon` inherits it
-- from there — so revoking from `anon` alone leaves has_function_privilege('anon', …)
-- still true and the hole wide open. Revoke PUBLIC first, then re-grant only the
-- roles that should actually have it.
revoke execute on function public.email_exists(text) from public;
revoke execute on function public.email_exists(text) from anon;
grant execute on function public.email_exists(text) to authenticated;

comment on function public.email_exists(text) is
  'Signed-in callers only. Deliberately NOT granted to anon: a pre-auth membership oracle over auth.users is a user-enumeration vector. See migration 0014.';

-- ---------------------------------------------------------------------------
-- 3. Pin mutable search_path
-- ---------------------------------------------------------------------------
-- A SECURITY DEFINER-adjacent function without a pinned search_path can be made
-- to resolve `sum`/operators against an attacker-controlled schema earlier in
-- the path. Cheap to close, so close it.
alter function public.top_set_weight_kg(jsonb, numeric) set search_path = public, pg_temp;
