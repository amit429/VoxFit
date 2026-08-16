-- 0000_initial_schema.sql
--
-- The project's history from before this folder existed.
--
-- VoxFit's first three months of schema changes were applied straight to the
-- Supabase project (dashboard / MCP) with no file checked in; versioned
-- migrations only start at 0001. That left the repo unable to rebuild the base
-- tables — every later migration assumed `user_profiles`, `workout_sessions`,
-- `exercises_logged` and `diet_logs` already existed. This file closes that
-- hole: it is the ten pre-folder migrations, in applied order, transcribed
-- verbatim from `supabase_migrations.schema_migrations` on the live project.
--
-- Applying it to the live project is a no-op — it is already there, and the DDL
-- is `if not exists` / `or replace` throughout. It exists so a **fresh** project
-- can be built from this folder alone: run this first, then 0001 onward.
--
-- Kept as one file rather than ten because these are one unit — the base schema
-- as it stood when the numbered sequence began. Each section keeps its original
-- version stamp and name so it can still be matched against the live project's
-- migration table one-for-one.
--
-- One caveat: the last section ends with two UPDATE statements that cleared
-- stored transcripts. On a fresh database they match zero rows. They are kept
-- because dropping them would make this file stop being a faithful record.


-- ---------------------------------------------------------------------------
-- [20260508195933] initial_voxfit_schema
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  sport_type TEXT CHECK (sport_type IN ('gym', 'runner', 'cyclist', 'sport')),
  goal TEXT CHECK (goal IN ('bulk', 'cut', 'maintain')),
  target_protein_g INT DEFAULT 160,
  target_calories INT DEFAULT 2500,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_select" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_profile_insert" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own_profile_update" ON user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own_profile_delete" ON user_profiles FOR DELETE USING (auth.uid() = id);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  session_label TEXT,
  raw_transcript TEXT NOT NULL,
  ai_summary TEXT,
  mood TEXT CHECK (mood IN ('positive', 'neutral', 'negative')),
  energy_level TEXT CHECK (energy_level IN ('high', 'medium', 'low')),
  physical_flags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_sessions_select" ON workout_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_sessions_insert" ON workout_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_sessions_update" ON workout_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_sessions_delete" ON workout_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS exercises_logged (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_name TEXT NOT NULL,
  exercise_type TEXT CHECK (exercise_type IN ('strength', 'cardio')),
  sets INT,
  reps INT,
  weight_kg NUMERIC(6,2),
  duration_secs INT,
  distance_km NUMERIC(6,2),
  is_pr BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE exercises_logged ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises_via_session_select" ON exercises_logged FOR SELECT USING (EXISTS (SELECT 1 FROM workout_sessions WHERE id = exercises_logged.session_id AND user_id = auth.uid()));
CREATE POLICY "exercises_via_session_insert" ON exercises_logged FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM workout_sessions WHERE id = exercises_logged.session_id AND user_id = auth.uid()));
CREATE POLICY "exercises_via_session_update" ON exercises_logged FOR UPDATE USING (EXISTS (SELECT 1 FROM workout_sessions WHERE id = exercises_logged.session_id AND user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workout_sessions WHERE id = exercises_logged.session_id AND user_id = auth.uid()));
CREATE POLICY "exercises_via_session_delete" ON exercises_logged FOR DELETE USING (EXISTS (SELECT 1 FROM workout_sessions WHERE id = exercises_logged.session_id AND user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS diet_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  meal_name TEXT NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  calories INT NOT NULL,
  protein_g NUMERIC(6,2),
  carbs_g NUMERIC(6,2),
  fat_g NUMERIC(6,2),
  source TEXT DEFAULT 'manual' CHECK (source IN ('ai_suggested', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE diet_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_diet_select" ON diet_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_diet_insert" ON diet_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_diet_update" ON diet_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_diet_delete" ON diet_logs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(date);
CREATE INDEX IF NOT EXISTS idx_exercises_logged_session_id ON exercises_logged(session_id);
CREATE INDEX IF NOT EXISTS idx_diet_logs_user_id ON diet_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_diet_logs_date ON diet_logs(date);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------------------
-- [20260508203623] grant_authenticated_table_privileges
-- ---------------------------------------------------------------------------

-- API roles must have table privileges; RLS still enforces row access.
-- Without this, Postgres returns 42501 before RLS runs.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises_logged TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diet_logs TO authenticated;

-- Optional: same for anon (RLS blocks unauthenticated access; needed for some PostgREST patterns)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises_logged TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diet_logs TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;


-- ---------------------------------------------------------------------------
-- [20260509072601] add_exercises_logged_summary_line
-- ---------------------------------------------------------------------------

alter table public.exercises_logged add column if not exists summary_line text;
comment on column public.exercises_logged.summary_line is 'Short display line from AI (e.g. 4 x 8 @ 60kg).';


-- ---------------------------------------------------------------------------
-- [20260509081757] add_exercises_logged_set_lines
-- ---------------------------------------------------------------------------

alter table public.exercises_logged
  add column if not exists set_lines jsonb not null default '[]'::jsonb;

comment on column public.exercises_logged.set_lines is 'Per-exercise load segments: [{"sets":number,"weight_kg":number|null,"reps":number|null,"reps_min":number|null,"reps_max":number|null,"duration_secs":number|null,"distance_km":number|null}]. Primary structure for voice AI logs.';


-- ---------------------------------------------------------------------------
-- [20260514185714] diet_logs_recipe_and_profile_macro_targets
-- ---------------------------------------------------------------------------

-- Recipe / meta on logged AI meals
ALTER TABLE public.diet_logs
  ADD COLUMN IF NOT EXISTS prep_minutes integer,
  ADD COLUMN IF NOT EXISTS rationale text,
  ADD COLUMN IF NOT EXISTS recipe_text text,
  ADD COLUMN IF NOT EXISTS raw_transcript text;

COMMENT ON COLUMN public.diet_logs.recipe_text IS 'Cooking instructions (markdown or plain numbered steps) saved when user logs an AI-suggested meal.';
COMMENT ON COLUMN public.diet_logs.raw_transcript IS 'Optional pantry/cravings transcript used for AI suggestion batch.';

-- Macro targets beyond calories + protein (defaults align with previous UI mocks)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS target_carbs_g integer NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS target_fat_g integer NOT NULL DEFAULT 65;


-- ---------------------------------------------------------------------------
-- [20260722205924] revoke_public_execute_handle_new_user
-- ---------------------------------------------------------------------------

revoke execute on function public.handle_new_user() from anon, authenticated;


-- ---------------------------------------------------------------------------
-- [20260722210055] add_data_validation_check_constraints
-- ---------------------------------------------------------------------------

-- Defense-in-depth beyond RLS: RLS controls *who* can write a row, these constrain *what*
-- can be written, so a compromised client or direct REST call still can't insert negative
-- numbers or unbounded text (verified against existing data first — nothing violates these).

alter table public.exercises_logged
  add constraint exercises_logged_sets_nonneg check (sets is null or sets >= 0),
  add constraint exercises_logged_reps_nonneg check (reps is null or reps >= 0),
  add constraint exercises_logged_weight_nonneg check (weight_kg is null or weight_kg >= 0),
  add constraint exercises_logged_duration_nonneg check (duration_secs is null or duration_secs >= 0),
  add constraint exercises_logged_distance_nonneg check (distance_km is null or distance_km >= 0),
  add constraint exercises_logged_name_len check (char_length(exercise_name) <= 200),
  add constraint exercises_logged_summary_len check (summary_line is null or char_length(summary_line) <= 500);

alter table public.diet_logs
  add constraint diet_logs_calories_nonneg check (calories >= 0),
  add constraint diet_logs_protein_nonneg check (protein_g is null or protein_g >= 0),
  add constraint diet_logs_carbs_nonneg check (carbs_g is null or carbs_g >= 0),
  add constraint diet_logs_fat_nonneg check (fat_g is null or fat_g >= 0),
  add constraint diet_logs_prep_minutes_nonneg check (prep_minutes is null or prep_minutes >= 0),
  add constraint diet_logs_name_len check (char_length(meal_name) <= 200),
  add constraint diet_logs_rationale_len check (rationale is null or char_length(rationale) <= 5000),
  add constraint diet_logs_recipe_len check (recipe_text is null or char_length(recipe_text) <= 20000),
  add constraint diet_logs_transcript_len check (raw_transcript is null or char_length(raw_transcript) <= 20000);

alter table public.workout_sessions
  add constraint workout_sessions_label_len check (session_label is null or char_length(session_label) <= 200),
  add constraint workout_sessions_summary_len check (ai_summary is null or char_length(ai_summary) <= 5000),
  add constraint workout_sessions_transcript_len check (raw_transcript is null or char_length(raw_transcript) <= 20000);

alter table public.user_profiles
  add constraint user_profiles_target_protein_nonneg check (target_protein_g is null or target_protein_g >= 0),
  add constraint user_profiles_target_calories_nonneg check (target_calories is null or target_calories >= 0),
  add constraint user_profiles_target_carbs_nonneg check (target_carbs_g is null or target_carbs_g >= 0),
  add constraint user_profiles_target_fat_nonneg check (target_fat_g is null or target_fat_g >= 0),
  add constraint user_profiles_display_name_len check (display_name is null or char_length(display_name) <= 200);


-- ---------------------------------------------------------------------------
-- [20260722210153] revoke_public_execute_handle_new_user_v2
-- ---------------------------------------------------------------------------

-- Previous revoke only touched anon/authenticated's own grants, but PUBLIC still had
-- EXECUTE (Postgres's implicit default on function creation), and PUBLIC covers every
-- role including anon/authenticated. Revoking from PUBLIC actually closes the RPC surface.
-- The AFTER INSERT trigger on auth.users still works: trigger invocation runs under the
-- function owner (SECURITY DEFINER), not through a role's EXECUTE grant.
revoke execute on function public.handle_new_user() from public;


-- ---------------------------------------------------------------------------
-- [20260722212254] optimize_rls_auth_uid_initplan
-- ---------------------------------------------------------------------------

-- Wrap auth.uid() as (select auth.uid()) so Postgres evaluates it once per query
-- instead of once per row (Supabase perf advisor: auth_rls_initplan).
-- Semantics are unchanged — same predicate, just cached via an InitPlan.

alter policy own_profile_select on public.user_profiles
  using ((select auth.uid()) = id);
alter policy own_profile_insert on public.user_profiles
  with check ((select auth.uid()) = id);
alter policy own_profile_update on public.user_profiles
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy own_profile_delete on public.user_profiles
  using ((select auth.uid()) = id);

alter policy own_sessions_select on public.workout_sessions
  using ((select auth.uid()) = user_id);
alter policy own_sessions_insert on public.workout_sessions
  with check ((select auth.uid()) = user_id);
alter policy own_sessions_update on public.workout_sessions
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy own_sessions_delete on public.workout_sessions
  using ((select auth.uid()) = user_id);

alter policy own_diet_select on public.diet_logs
  using ((select auth.uid()) = user_id);
alter policy own_diet_insert on public.diet_logs
  with check ((select auth.uid()) = user_id);
alter policy own_diet_update on public.diet_logs
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy own_diet_delete on public.diet_logs
  using ((select auth.uid()) = user_id);

alter policy exercises_via_session_select on public.exercises_logged
  using (exists (select 1 from workout_sessions where workout_sessions.id = exercises_logged.session_id and workout_sessions.user_id = (select auth.uid())));
alter policy exercises_via_session_insert on public.exercises_logged
  with check (exists (select 1 from workout_sessions where workout_sessions.id = exercises_logged.session_id and workout_sessions.user_id = (select auth.uid())));
alter policy exercises_via_session_update on public.exercises_logged
  using (exists (select 1 from workout_sessions where workout_sessions.id = exercises_logged.session_id and workout_sessions.user_id = (select auth.uid())))
  with check (exists (select 1 from workout_sessions where workout_sessions.id = exercises_logged.session_id and workout_sessions.user_id = (select auth.uid())));
alter policy exercises_via_session_delete on public.exercises_logged
  using (exists (select 1 from workout_sessions where workout_sessions.id = exercises_logged.session_id and workout_sessions.user_id = (select auth.uid())));


-- ---------------------------------------------------------------------------
-- [20260722215012] stop_requiring_and_clear_raw_transcript
-- ---------------------------------------------------------------------------

-- raw_transcript is write-only dead data (verified: read in exactly one place in the app,
-- home.page.ts's `recentParsed` computed, which is itself never rendered). Stop requiring it
-- so the app can omit it going forward, and clear what's already stored (data minimization —
-- no reason to keep raw voice transcripts nothing in the product ever reads again).

alter table public.workout_sessions alter column raw_transcript drop not null;

update public.workout_sessions set raw_transcript = null where raw_transcript is not null;
update public.diet_logs set raw_transcript = null where raw_transcript is not null;
