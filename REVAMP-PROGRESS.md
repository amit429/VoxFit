# VoxFit UI revamp — progress log

Tracking the migration from the Linear-inspired flat dark system to **Dusk** (the
"Kinetic" redesign). Source brief: `~/Downloads/voxfit-redesign-handoff/IMPLEMENTATION.md`,
mockups in `mockups/`, reference HTML in `html-source/`.

Branch: `feat/kinetic-ui-revamp`

Keep this updated at every checkpoint — if context runs out mid-way, this file is how the
next session resumes without redoing work.

---

## Scope correction — the brief is written against a stale snapshot

`IMPLEMENTATION.md` Phases 4 and 5 are **already built in this repo**. Verified against the
live Supabase project (`nmjtvqpuepbkddruvlix`) and the source tree:

| Brief claims missing | Actual state |
|---|---|
| "no `supabase/migrations/`" | Exists — `0001`–`0005` |
| `workout_plans` table | Exists, with the partial unique active-plan index |
| `progress_reviews` table | Exists — plus `plan_nudges`, which the brief doesn't know about |
| AI Workout Plan Generator (5.1) | Built — `generate-workout-plan/` edge fn, `gemini-workout-plan.service.ts`, `workout-plan.page.*` |
| AI Progress Coach (5.2) | Built — `generate-checkin/` edge fn, `progress-coach.service.ts`, `progress-review-card`, `plan-nudge-card` |
| Account deletion (4.5) | Built — `delete-account` edge fn + typed-DELETE confirm in Settings |

**Effective scope: brief Phases 1–3 + 6**, plus a little new frontend. No migrations, no
edge-function changes, no schema changes in this work.

## Decisions

- **Muscle map + muscle split omitted entirely.** Not built, not stubbed. Requires muscle-group
  data that does not exist anywhere in the schema. See Deferred #1.
- **Profile stays one scrolling page.** Mockups `04_progress` + `07_profile` merge into
  `/tabs/profile`. No new route, no guard changes.
- **Voice capture keeps hold-to-record.** `VoiceSessionService` interaction untouched; visuals
  only. Copy reads "Hold and say your workout", not the mockup's "Tap".
- **Phase-by-phase with review checkpoints.**

---

## Phase 1 — Design tokens & typography ✅

**Checkpoint 1 met.** `npm run build` ✅ · `npm run lint` ✅ · 33/33 tests ✅ · auth screens
verified in-browser on the new gradient.

### Files touched

| File | Change |
|---|---|
| `src/theme/variables.scss` | Replaced with the Dusk palette — **merged, not copied over** (see below) |
| `src/theme/fonts.scss` | Poppins 500/600/700 in, Inter out, JetBrains Mono 700 added |
| `src/global.scss` | Canvas gradient moved to `ion-app`; accent + radius entries added to the `@theme` bridge |
| `src/theme/vox-ui.scss` | New `.vx-canvas` / `.vx-atmo` / `.vx-blob` / `.vx-grain` / `.vx-layer` / `.vx-rim` utilities |
| `src/theme/app-headers.scss` | Toolbar background retargeted to the new canvas |
| `src/theme/vox-buttons.scss` | Primary CTA now uses `--vox-brand-gradient` + `--vox-on-brand` |
| `src/theme/auth-screens.scss` | `.auth-flow` and `.auth-toolbar` transparent over the shell gradient |
| `src/app/pages/auth/welcome/welcome.page.scss` | `--background` transparent |
| `src/app/pages/home/home.page.html`, `diet.page.html` | Dead `vx-text-6` class replaced |
| `package.json` | `+@fontsource/poppins` |

### The token file is **not** drop-in — things the handoff file dropped that are still consumed

Re-appended after taking the new file wholesale:

- `--ion-color-medium` / `-rgb` — consumed by `global.scss`'s input-placeholder rule and a
  `color="medium"` template binding
- `--ion-color-danger` / `-rgb` — consumed by a `color="danger"` template binding
- `--ion-card-background`, `--ion-border-color`, `--ion-color-secondary*`,
  `--ion-color-success*`, `--ion-color-warning*` — Ionic component internals
- `.ion-palette-dark` block — `dark.always.css` is imported in `global.scss`, so this class is
  always active and must be retargeted alongside `:root`
- `ion-tab-bar` rules — including `transform: translateZ(0)` / `will-change`, which is a
  **load-bearing scroll-jitter fix**, not decoration. Do not remove.
- `--vox-text-muted` / `--vox-text-hint` — kept as aliases

The legacy alias block is intact and load-bearing: it is what lets unmigrated screens recolour
for free between Phase 1 and Phase 3.

### Notes for later phases

- **Canvas gradient lives on `ion-app`, not on `ion-content`.** Painting it per-ion-content
  restarts the ramp below each header and cuts a visible seam at the toolbar. `ion-content` is
  transparent by default now. Any page that sets its own `--background` must set it to
  `transparent`, not to a colour.
- `--vox-radius-xl` changed 16px → 18px, so every existing `rounded-xl` restyled. Intended.
- The gradient custom property is kept **on one line** — Sass preserves newlines inside
  custom-property values and some WebView versions reject the result.
- Tailwind 4.2.4 still silently drops any class containing `.` `[` `]` `/`. Keep using the
  `.vx-*` escape hatches in `vox-ui.scss`. Two dead `vx-text-6` references were found and fixed
  during this phase — that class was never defined and had been silently doing nothing.

### Not yet visually verified

Tab pages (`/tabs/*`), `/voice`, `/log-diet`, `/settings` are behind `onboardingCompleteGuard`
and were not screenshotted — no test session available in the Playwright browser. They build
and lint clean, and inherit the recolour through the legacy aliases. Verify at Checkpoint 3.

---

## Phase 2 — Component primitives ⏳ not started

## Phase 3 — Screen migration ⏳ not started

## Phase 4 — Data-backed additions ⏳ not started

## Phase 5 — Polish ⏳ not started

---

## Deferred features — mockup UI with no data behind it

Nothing here blocks the redesign. Each is a real gap between the mockups and the schema.

1. **Muscle map + muscle split** (`04_progress` "This week you hit"; `12` "Volume by muscle
   group") — `exercises_logged` stores only an exercise name; muscle group exists nowhere in the
   schema. Needs: an `exercise_muscle_map` lookup table (normalized name PK, primary + secondary
   muscle) seeded with common lifts; nullable `primary_muscle`/`secondary_muscle` columns on
   `exercises_logged` resolved and denormalized at write time; the `extract-workout` prompt
   extended to return `primary_muscle` constrained to a fixed enum
   (`chest|back|legs|glutes|shoulders|arms|core|cardio|other`), validated app-side against the
   enum with `other` as fallback — never trust the model's string; a backfill of existing rows.
   **Omitted from this pass by decision.**

2. **Weekly session target** (`04_progress` activity ring "4/5") — `user_profiles` has no target
   column. Interim: read sessions-per-week off the active `workout_plans` row, else default 5.
   Proper fix is a `weekly_session_target` column plus a Settings stepper.

3. **Badge earn history** (`07_profile` badge shelf) — no `user_badges` table. Badges will be
   derived client-side from live counts, so there is no earned-at date and no new-badge moment.
   Proper fix: `user_badges` (`user_id`, `badge_key`, `earned_at`, unique on the pair, RLS on
   `auth.uid()`), evaluated after each session/meal write.

4. **Reminders toggle** (`08_settings`) — no push or local-notification infrastructure (no FCM,
   no `@capacitor/local-notifications`). A dead toggle is worse than an absent one; omitted.

5. **Export my data as CSV** (`08_settings`) — no export endpoint or client-side CSV builder.

6. **Notification bell** (`01_home` top bar) — no notification centre. Slot filled by the
   avatar/profile link.

7. **Filter sheet: session type + min volume** (`13_components`) — `workout_sessions` has no
   session-type column, and min-volume needs `set_lines`, which the journal's lean paginated
   query deliberately omits for cost. Mood / has-PRs / has-notes ship.

8. **"Share my streak"** (`06_streak_moment`) — no share-image generation, no `@capacitor/share`.
   Milestone modal ships without the share button.

9. **"You're trending up / best 4-week stretch"** (`11_components` nudge state) — needs a rolling
   multi-week volume comparison; only the current and previous week are loaded today.

10. **Per-meal emoji** (`05_fuel`) — `diet_logs` has no emoji column. AI-suggested meals carry one
    transiently but it is not persisted. Interim: derive an icon from `meal_type`.

11. **Plan session progress** (`09_my_plan` "8 of 24 sessions done") — `plan_nudges` carries
    `planned_sessions`/`completed_sessions` but only for its own week; whole-plan completion is
    not tracked. Confirm against `WorkoutPlanService` before promising the 6-week bar.
