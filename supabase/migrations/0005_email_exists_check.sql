-- 0005_email_exists_check.sql
-- Registration UX: signUp() for an already-registered, confirmed email doesn't error (see
-- AuthService.isAlreadyRegisteredSignUpResponse), so the register page now pre-checks the
-- email as the user types and disables submit if it's taken. That check needs a way to ask
-- "does this email exist" without exposing the full auth.users table (which isn't reachable
-- via PostgREST/RLS at all) or any other user data — a SECURITY DEFINER function returning
-- only a boolean is the standard, minimal-leak pattern for this.

create or replace function public.email_exists(check_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(check_email)
  );
$$;

grant execute on function public.email_exists(text) to anon, authenticated;
