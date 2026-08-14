-- Height, weight, and a DB-computed BMI.
--
-- BMI is a generated column rather than a trigger: Postgres recomputes it on
-- every insert/update to height_cm or weight_kg with no trigger function to
-- maintain, and it can never drift out of sync with its inputs.

alter table public.user_profiles
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_height_cm_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_height_cm_check
      check (height_cm is null or (height_cm > 0 and height_cm <= 300));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_weight_kg_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_weight_kg_check
      check (weight_kg is null or (weight_kg > 0 and weight_kg <= 500));
  end if;
end $$;

alter table public.user_profiles
  add column if not exists bmi numeric generated always as (
    case
      when height_cm is not null and weight_kg is not null and height_cm > 0
        then round(weight_kg / ((height_cm / 100.0) ^ 2), 1)
      else null
    end
  ) stored;

comment on column public.user_profiles.height_cm is 'Height in centimetres. Set during onboarding, editable in Settings.';
comment on column public.user_profiles.weight_kg is 'Weight in kilograms. Set during onboarding, editable in Settings.';
comment on column public.user_profiles.bmi is 'weight_kg / (height_cm/100)^2, rounded to 1dp. Generated column — recalculates automatically whenever height_cm or weight_kg changes.';
