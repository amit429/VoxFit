-- Per-tour "seen" flags for the driver.js product walkthrough.
--
-- Three fixed, known tours — plain boolean columns on user_profiles, same
-- pattern as onboarding_completed, rather than a JSONB blob or a separate
-- table (see docs/superpowers/specs for the walkthrough design writeup).
--
-- New default is false so brand-new sign-ups see the tours, but existing
-- users must not suddenly be shown a first-time walkthrough after this
-- ships — backfill anyone already onboarded to "already seen".

alter table public.user_profiles
  add column if not exists tour_orientation_seen boolean not null default false,
  add column if not exists tour_workout_seen boolean not null default false,
  add column if not exists tour_meal_seen boolean not null default false;

update public.user_profiles
set
  tour_orientation_seen = true,
  tour_workout_seen = true,
  tour_meal_seen = true
where onboarding_completed = true;

comment on column public.user_profiles.tour_orientation_seen is 'Has this user completed or dismissed the App Orientation walkthrough. Backfilled true for pre-existing users.';
comment on column public.user_profiles.tour_workout_seen is 'Has this user completed or dismissed the Voice Workout walkthrough. Backfilled true for pre-existing users.';
comment on column public.user_profiles.tour_meal_seen is 'Has this user completed or dismissed the Meal Logging walkthrough. Backfilled true for pre-existing users.';
