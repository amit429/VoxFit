-- Per-meal emoji.
--
-- The meal rows and the recipe dialog have always shown an emoji, but it was
-- derived from `meal_type` — so every lunch was the same salad glyph and a
-- 300-meal history looked like four repeating icons. The model that already
-- names the meal is in the best position to pick its glyph, and asking for one
-- costs nothing on a call that is being made anyway.
--
-- Nullable on purpose: every row written before this column existed keeps
-- falling back to the meal-type glyph, and so does any row where the model
-- returned something that failed validation. `mealEmoji()` on the client is the
-- single place that resolution happens.
--
-- The length cap is a sanity bound, not a grapheme check — a ZWJ sequence such
-- as 👨‍🍳 is five code points and 11 bytes, so anything tighter would reject
-- legitimate emoji. Client-side parsing is what rejects prose; this only stops
-- a paragraph from being stored in an icon column.

alter table public.diet_logs
  add column if not exists emoji text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'diet_logs_emoji_length_check'
  ) then
    alter table public.diet_logs
      add constraint diet_logs_emoji_length_check
      check (emoji is null or char_length(emoji) between 1 and 16);
  end if;
end $$;

comment on column public.diet_logs.emoji is
  'Single emoji for the meal, chosen by the model at log time. Null falls back to a meal-type glyph on the client.';
