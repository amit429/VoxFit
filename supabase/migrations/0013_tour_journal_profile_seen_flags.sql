alter table public.user_profiles
  add column if not exists tour_journal_seen boolean not null default false,
  add column if not exists tour_profile_seen boolean not null default false;

update public.user_profiles
set
  tour_journal_seen = true,
  tour_profile_seen = true
where onboarding_completed = true;

comment on column public.user_profiles.tour_journal_seen is 'Has this user completed or dismissed the Journal (Train tab) walkthrough. Backfilled true for pre-existing users.';
comment on column public.user_profiles.tour_profile_seen is 'Has this user completed or dismissed the Profile (You tab) walkthrough. Backfilled true for pre-existing users.';
