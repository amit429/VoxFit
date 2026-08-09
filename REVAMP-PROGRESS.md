# VoxFit UI revamp — progress log

Tracking the migration from the Linear-inspired flat dark system to **Dusk** (the
"Kinetic" redesign). Source brief: `~/Downloads/voxfit-redesign-doc/IMPLEMENTATION.md`,
mockups in `mockups/`, reference HTML in `html-source/`. The device-framed mockups of the
finished screens are committed to this repo at `mockups/` and are what the README and the
Notion PRD illustrate.

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

## Phase 2 — Component primitives ✅

**Checkpoint 2 met.** `npm run build` ✅ · `npm run lint` ✅ · 33/33 tests ✅ · every primitive
eyeballed in isolation at 390px via the temporary `/gallery` route.

### Updated

| Component | Change |
|---|---|
| `vox-card` | Glass, 18px radius, rim-light. Variants `glass`\|`brand`\|`jade`\|`apricot`\|`rose`, plus an `interactive` input. Old `resting`/`raised`/`interactive` variants retired — call sites updated. |
| `vox-badge` | Now the chip: pill by default, 30px, role-assigned tones. `success`/`warning`/`danger`/`accent` retained as aliases so existing call sites keep working. New `size` input (`md`\|`xs`). |
| `vox-skeleton` | Shimmer over glass instead of an opacity pulse. |
| `exercise-sets-preview-table` | Table → the mockup's `.setrow` pill list. Drops the horizontal scroller it needed at 390px; PR row highlights apricot. |
| `session-exercise-review-card` | Coach note is now a `brand` card with the shared AI mark; stale `vox-card` variants and a broken `text-[1rem]` class fixed. |

`vox-page-header` was left alone — it is auth-only per the convention in CLAUDE.md, and the
auth screens already recolour correctly through the tokens.

### New (17)

`vox-voice-orb`, `vox-streak-pill`, `vox-stat-tile`, `vox-quick-action-grid`, `vox-plan-banner`,
`vox-progress-nudge`, `vox-macro-ring`, `vox-activity-ring`, `vox-volume-chart`,
`vox-trend-chart`, `vox-heatmap`, `vox-badge-shelf`, `vox-segmented`, `vox-date-scrubber`,
`vox-filter-sheet`, `vox-stepper-row`, `vox-streak-celebration`.

Plus two services: `badge.service.ts` (derives the shelf from live counts) and
`streak-milestone.service.ts` (localStorage bookkeeping so a milestone celebrates once).

Not built: `vox-muscle-map`, `vox-muscle-split` — Deferred #1.

### Decisions worth carrying forward

- **The card rim-light is a background layer, not a `::before`.** A positioned pseudo-element
  paints above static content, and card content arrives through `ng-content` — it belongs to
  the parent component, so emulated encapsulation gives no selector to lift it back on top.
  As a background layer it is behind content by construction.
- **Data-shaped interfaces went to `src/app/models/`** (`VoxQuickAction`, `VoxVolumeBar`,
  `VoxTrendPoint`, `VoxSegment`, `VoxEarnedBadge`, `VoxSessionFilters`), re-exported through
  the barrel, per the convention in CLAUDE.md. Component *variant unions* stay co-located,
  matching how `VoxCardVariant` and `VoxIconTone` already work.
- **Tap targets are grown with padding, not size.** `vox-stepper-row`'s buttons stay 26px
  visually with `content-box` padding + negative margin to reach 44px; `vox-filter-sheet`'s
  chips wrap `vox-badge` in a 44px-tall button.
- **`--vox-on-jade` / `--vox-on-apricot` are used everywhere those fills appear** — segmented
  control, plan-banner CTA, streak dots. White on either fails contrast badly.

### Temporary

`/gallery` (`src/app/pages/gallery/*` + its route in `app.routes.ts`) is a dev-only component
gallery, unguarded, rendering static demo data only. Kept through Phase 3 as the fastest way
to check primitives while migrating screens. **Delete it in Phase 5 before merge** — it is
marked `TEMP` at the route.

## Phase 3 — Screen migration ✅

**Checkpoint 3 met.** `npm run build` ✅ · `npm run lint` ✅ · 33/33 tests ✅ · all 8 routes
return 200 · Home / Voice / Train / Fuel / Profile / Settings verified in-browser at 390px.

### Migrated

| Route | Notes |
|---|---|
| `/tabs/home` | Orb is the hero. Streak pill → greeting → orb → fuel card → quick actions → last session. The old two CTAs folded into `vox-quick-action-grid`. Milestone modal wired via `StreakMilestoneService`. |
| `/voice` | Radial violet atmosphere, orb at `lg`, live transcript from `voiceSession.transcriptPreview()`. **Hold-to-record unchanged.** Done state is the mockup's session-result layout. |
| `/tabs/workout/:id` | Hero stat tiles, brand coach card, `.setrow` sets, rose "You mentioned" card. |
| `/tabs/workout` | Plan banner, filter chips, `vox-volume-chart`, session rows, `vox-filter-sheet`. Month/date picker modals kept as-is, retinted. |
| `/tabs/diet` | Renamed **Fuel** (label + title only). Calorie ring, two equal-weight voice mode cards, `vox-segmented`, `vox-meal-row`. |
| `/log-diet` | Orb states, mode cards matching Fuel, live transcript. Accepts `?mode=suggest\|log_eaten` so the Fuel cards deep-link straight into a mode. |
| `/tabs/profile` | One scroll: identity → check-in → stats → badges → heatmap → activity ring → trend → monthly charts → preferences. |
| `/settings` | Chip pickers, `vox-stepper-row` targets, account rows. Delete Account present, rose, typed-DELETE confirm preserved. |
| `/tabs/workout/plan` | Shell restyled; `vox-plan-review-card` moved onto `vox-card`. |
| tab bar | Home / Train / **Fuel** / You, active state periwinkle. |
| auth | Already correct from Phase 1 — no page-level changes needed. |

### Pulled forward from Phase 4

Profile's trend chart needed them, so they landed here rather than in the next phase:
`WorkoutJournalService.getExerciseTrend()` and `.listTopExercises()`, bounded by
`TREND_WINDOW_WEEKS` / `TREND_TOP_EXERCISES` constants in one place. `BadgeService` is wired
into Profile. `vox-filter-sheet` is wired into Train.

### Decisions worth carrying forward

- **`flagsSummary()` was reworded at the source.** It returned "Physical Flags" / "No issues
  noted"; it now returns "You mentioned" / "Nothing noted" plus a `hasFlags` boolean so the UI
  can omit the card entirely. The old wording put free-text speech-recognition output into
  clinical register, which the AI Coach PRD explicitly rules out. `WorkoutDetailMock` gained
  `hasFlags`.
- **`vox-icon` gained `ink-tertiary` plus the role tones** (`brand`/`jade`/`apricot`/`rose`),
  with `accent`/`success`/`warning`/`danger` kept as aliases.
- **`vox-meal-row` was extracted** because the Fuel screen rendered the same meal markup in
  both day and week views and the two copies had already drifted.
- **`vox-volume-chart` suppresses its total when there is no data** — "0 kg" above an empty
  state reads as a measured zero rather than an absence of measurements.
- **The trend chart walks the top-N exercises** until one yields ≥2 plottable points. The
  most-logged lift is often bodyweight (push-ups), which has no top-set weight; showing its
  title over an empty chart reads as a bug.
- **`flatMap` is not available** — this tsconfig's lib predates it. Use `push` in loops.
- Three more silently-dead arbitrary-value Tailwind classes found and fixed
  (`[--background:...]` on four pages, `max-w-[250px]`, `text-[1rem]`).

## Phase 4 — Data-backed additions ✅

**Checkpoint 4 met.** `npm run build` ✅ · `npm run lint` ✅ · **57/57 tests** ✅ (was 33) ·
filter sheet exercised end-to-end in-browser.

Most of this phase's service work landed in Phase 3, because Profile's trend chart needed it.
What this phase actually did was verify the wiring, fix two bugs it exposed, and put the new
logic under test.

### Bugs found and fixed

1. **Mood filtering matched sessions with no mood.** Filtering compared
   `moodEmoji(session.mood)` against `moodEmoji(filterValue)` — but `moodEmoji(null)` and
   `moodEmoji('neutral')` both render 😐, so selecting "Neutral" also returned every session
   with no mood recorded. `WorkoutSessionListMock` now carries the narrowed `mood: MoodDb | null`
   alongside the emoji, and filtering tests the value. Narrowing happens once in
   `sessionToListItem` via an `isMoodDb` type guard rather than a cast, so an unexpected DB
   value becomes `null` instead of a union member that silently fails to match.

2. **The sheet's "Show N sessions" CTA was always stale.** It counted the *applied* filters,
   but the sheet stages edits locally and only emits on apply — so toggling a chip never moved
   the number. The sheet now emits `stagedChange` on every edit; the page keeps `sessionFilters`
   (drives the list) separate from `stagedFilters` (drives the preview only), so the count can
   move without the list shifting under the user. Verified live: 4 → 2 (PRs) → 1 (PRs+Notes)
   → 4 (reset) → 3 (Positive).

### Added

- `utils/session-filter.util.ts` — `sessionMatchesFilters()` / `countMatchingSessions()`. One
  predicate, shared by the list and the preview count, so the two can't disagree again.
- `vox-filter-sheet` now renders at content height (`vox-sheet-auto`) and suppresses Ionic's
  default handle, which was stacking a second grabber above its own.

### Tests (24 new)

`badge.service.spec.ts`, `streak-milestone.service.spec.ts`, `session-filter.util.spec.ts`,
`workout-display.util.spec.ts`. The last one includes a **framing guard**: it asserts
`flagsSummary()` output contains none of "flag", "diagnos", "health", "injur", "symptom",
"issue". That is a product-safety requirement from the AI Coach PRD, not a copy preference —
a test is the only thing that stops it regressing.

## Phase 5 — Polish + vibrancy, spacing, streak page ✅

**Checkpoint 5 met.** `npm run build` ✅ · `npm run lint` ✅ · **66/66 tests** ✅ · all routes 200.

### Vibrancy pass (user feedback)

Every accent's saturation raised ~1.22×, **hue and role unchanged** — computed in HLS so the
palette shifts together rather than drifting. Tint alphas raised (dims 0.16–0.20 → 0.22–0.26,
borders → 0.40–0.52) so a tinted surface reads as coloured rather than grey-with-a-hint, and
the canvas gradient carries a little more hue. The two comments claiming accents are
"desaturated" were rewritten — restraint here is structural (one job per accent, faint glows),
not chromatic.

### Spacing pass (user feedback)

- New `--vox-space-stack` (20px) and `--vox-space-card` (18px) tokens.
- `.vx-stack` / `.vx-stack-tight` utilities using the lobotomised-owl selector. Pages set the
  rhythm once on `<main>` instead of sprinkling `mt-3.5` on every child — so it stays even when
  sections are added or reordered, and is tuned in one place.
- Card padding 16 → 18px, page gutters 1rem → 1.25rem, bottom room 5.5 → 6.5rem.
- Verbose copy shortened across five screens.

### Streak page (`/streak`)

Reached by tapping the streak pill on Home. Built as a **page, not a modal**: it deep-links,
it's a destination the user chooses, and it keeps one implementation of this visual.
`vox-streak-celebration` was deleted — it would have been a second copy of the same screen.

Data derives entirely from the activity window the journal already loads: current streak and
week dots from `streak()`, plus a new `computeLongestStreakDays()` for best-run and days-logged.
No new fetch. "Share my streak" uses the **Web Share API**, which the Capacitor WebView already
provides — no new plugin — with a clipboard fallback. Hidden at a zero streak.

### Bug the streak page exposed

`computeWorkoutStreakDays()` walked backward past *any* number of empty days to find the most
recent session, so a single workout three weeks ago reported a live 1-day streak — while the
week dots correctly showed nothing logged. It now allows one day of grace for today (the day
isn't over) and returns 0 if neither today nor yesterday has a session. Five regression tests.

### Polish

- **Reduced motion**: audited every `animation:` declaration; two files had no guard
  (`session-exercise-review-card`, the shared `.vox-wave-bar`). All silenced now.
- **Touch targets**: seven pages each defined their own circular icon button at 36–40px, all
  under the 44px minimum. Consolidated into one `.vx-icon-btn` that keeps the 38px visual and
  grows the *hit area* to 44px with `content-box` padding + negative margin.
- **Android chrome**: `@capacitor/status-bar` was a dependency that was never called. Wired in
  `AppComponent`, native-only, matching the canvas top stop (`#1c1536`).
- **Splash**: `index.html` still painted the old flat `#0a0a0c`, flashing before the first
  screen. Now the canvas gradient.
- **Removed** the temporary `/gallery` route and page.

---

## Phase 6 — Progress page split + check-in dialog ✅

**Verified.** `npm run build` ✅ · `npm run lint` ✅ · 66/66 tests ✅ · all 10 routes 200.

Profile had grown to a dozen stacked cards — identity, badges and preferences competing with
six charts and an inline AI review several hundred words long. Split three ways:

- **New `/progress` page** (`04_progress` in the mockups): all-time stat tiles, sessions-this-week
  ring, weekly volume, strength trend, activity heatmap, and both monthly charts. Standalone
  route with a back button, matching how `/settings` already works. Home's "my progress" quick
  action now points here instead of at the profile tab.
- **Profile keeps** identity, the compact check-in nudge, a "My progress" link card, badges and
  preferences.
- **New `vox-checkin-modal`**: the full review in a centred dialog (`vox-centre-modal`), capped
  at 80vh with only the body scrolling so the header and close stay reachable. Centred rather
  than a bottom sheet because this is content to read, not a control to operate.

The CTA carries the loading state rather than opening an empty dialog and spinning inside it:
when there is no review yet, "See my check-in" becomes "Reading your data…", generation runs,
and the dialog opens only once there is something to read. A modal that appears and then fills
in reads as broken.

`progress-review-card` lost its own card wrapper and title. Its only consumer is now the modal,
which supplies both — keeping them nested a card inside a card and printed "Your check-in"
twice.

---

## Phase 7 — Weekly target + persisted badges (migration 0006) ✅

**Verified.** `npm run build` ✅ · `npm run lint` ✅ · 67/67 tests ✅ · both features exercised
end-to-end against the live project.

Closes deferred items #2 and #3.

### Weekly session target

`user_profiles.weekly_session_target` (integer, default 4, DB check 1–14). Asked during
onboarding as a 2–7 chip row — the useful range is small enough that every option can be one
tap away rather than hidden behind a stepper or action sheet — and editable in Settings under
its own "Training goal" group, since it is a training goal rather than a nutrition target.

The progress ring reads the profile. It previously inferred the target from the active plan's
day count, which moved the goalpost whenever the plan changed and only existed if a plan did;
`/progress` no longer depends on `WorkoutPlanService` at all.

### Badges: awarded and stored server-side

Three objects, all in `0006`:

- `badge_definitions` — `badge_key`, `metric`, `threshold`, `sort_order`. Seeded with 13 badges.
  **This is the awarding authority**: thresholds live in the database, not app code.
- `user_badges` — `(user_id, badge_key)` PK, `earned_at`. RLS allows **select only**; there is
  deliberately no insert/update/delete policy, so a badge cannot be self-granted from a client.
- `get_user_progress_stats(p_today date)` — `SECURITY DEFINER`. Returns workouts, PRs, streak
  and the full shelf, and awards anything newly earned via `ON CONFLICT DO NOTHING`.

**Awarding happens on read, not in a write trigger.** It is idempotent, keeps the threshold
logic in one place, and cannot be missed by a write path that forgets to call it. Only the
workout tables feed these metrics, so a meal write has nothing to trigger.

`BadgeService` no longer evaluates anything — it maps `badge_key` to emoji/label/tone. An
unknown key renders with a neutral fallback so seeding a new badge server-side doesn't drop a
tile until the app ships again.

### API calls collapsed

Profile and `/progress` each made two count-only queries and then evaluated badges client-side.
Both now make **one** RPC that returns stats *and* the shelf *and* persists new awards.

### Two things worth knowing

- **`p_today` is a parameter, not `current_date`.** `workout_sessions.date` holds the user's
  *local* date while `current_date` is the server's. Verified on the live data: server date
  2026-08-08 returned streak 0, the user's local 2026-08-09 returned 1. Letting Postgres pick
  would break or extend streaks by a day for anyone far from UTC.
- **The advisor flags `get_user_progress_stats` as a SECURITY DEFINER function callable by
  `authenticated`.** That is the point: it is what lets the function write `user_badges` while
  clients cannot. It takes no user id — the subject is always `auth.uid()` — so a signed-in
  caller can only ever affect their own rows.

Also fixed while wiring this: `writeProfilePatch` builds its update row field by field, so
adding the field to the *type* was not enough — the new column silently didn't save until the
assignment was added too. Caught by checking the DB after saving, not by the compiler.

---

## Phase 8 — Muscle groups (migration 0007) ✅

**Verified.** `npm run build` ✅ · `npm run lint` ✅ · 67/67 tests ✅ · the full async pipeline
exercised against the live project.

Closes deferred item #1, and adds the macro rings to `/progress`.

### Two-tier resolution, cheapest first

1. **`exercise_muscle_map`** — a **global** lookup keyed on a normalized exercise name, seeded
   with 91 common lifts. Most logs resolve instantly, deterministically, free.
2. Anything the lookup misses is classified once by Gemini, **asynchronously**, and written back
   into the same lookup. Because the lookup is global rather than per-user, each novel exercise
   name costs exactly one AI call for the whole product, ever.

Muscles are denormalized onto `exercises_logged.primary_muscle` by a `before insert` trigger.
That is what makes the Progress queries indexed aggregates instead of a classify-on-read.

### The async path never blocks a log

An `after insert ... for each statement` trigger with a transition table collects the
unresolved names — **one** request per session, not one per exercise — and fires
`pg_net.http_post` at the `classify-exercise-muscles` edge function, following the same
Vault-secret pattern as the weekly check-in cron. The insert commits immediately.

The function re-checks the cache before spending a call (two sessions logged back to back
would otherwise both pay), validates every returned group against the enum with `other` as
fallback, refuses names it did not ask about, upserts the map, then backfills every
unclassified row with those names across all users.

**Verified end-to-end on live data**: 9 pending rows with names the seed doesn't cover
("Pec Fly", "Chest Flies", "Decline Crunches", "Flyes"…) → Gemini classified 8 novel keys
correctly → backfill closed all 9 → `pending` went 9 → 0, `classified` 29.

### One deliberate deviation from the brief

**There is no per-user rollup table.** Both views are `GROUP BY`s over the indexed
`primary_muscle` column via `get_muscle_breakdown(p_week_start, p_week_end)`. A rollup would
have to be fully recomputed per user whenever a session is edited or deleted — the same cost as
just querying — while adding a way for the numbers to go stale. The genuinely expensive part of
this feature is the AI classification, and that *is* cached permanently. Week bounds come from
the client so the week is the user's own Monday, not the server's.

### Components

`vox-muscle-map` — front-view figure plus chips. Jade for the two highest-volume groups, brand
for the rest that were trained; ranking by volume is what makes it answer "what did I focus on"
rather than "what did I touch". `back` and `glutes` are chip-only: there is no front-view region
to fill, and faking one would be worse than being silent.

`vox-muscle-split` — share bars, ordered by share since the ranking is the point. Cardio is
excluded (no tonnage, so including it would make every strength share read low).

**Both name what they cannot show.** The map reports how many exercises are still being
classified; the split names groups that were trained but carry no tonnage — "Core and Back came
from bodyweight work, which carries no tonnage to chart." Without that line, a user who trained
back twice sees "Chest 100%" and reasonably concludes the chart is broken.

Macro rings reuse the existing `vox-macro-ring`, wired to today's macros.

### Hardening (advisor follow-up, applied)

- `resolve_exercise_muscles` is a trigger function, but PostgREST exposed it at
  `/rest/v1/rpc/resolve_exercise_muscles` to `anon` and `authenticated`. Calling it outside a
  trigger errors, so it was not exploitable — but that endpoint should not exist. Revoked, then
  **re-verified the trigger still resolves** by round-tripping a probe row (Barbell Squat →
  `legs`) and deleting it.
- `normalize_exercise_key` / `exercise_volume_kg` had role-mutable search paths; both pinned.

### Known limitation

The normalizer strips one trailing `s`, so "Flies" becomes "flie" and does not collapse onto
"fly". Proper English plural handling in SQL is a rabbit hole, and the two-tier design already
absorbs it: the odd spelling is classified once and cached forever.

---

## Deferred features — mockup UI with no data behind it

Nothing here blocks the redesign. Each is a real gap between the mockups and the schema.

4. **Reminders toggle** (`08_settings`) — no push or local-notification infrastructure (no FCM,
   no `@capacitor/local-notifications`). A dead toggle is worse than an absent one; omitted.

6. **Notification bell** (`01_home` top bar) — no notification centre. Slot filled by the
   avatar/profile link.

7. **Filter sheet: session type + min volume** (`13_components`) — `workout_sessions` has no
   session-type column, and min-volume needs `set_lines`, which the journal's lean paginated
   query deliberately omits for cost. Mood / has-PRs / has-notes ship.

11. **Plan session progress** (`09_my_plan` "8 of 24 sessions done") — `plan_nudges` carries
    `planned_sessions`/`completed_sessions` but only for its own week; whole-plan completion is
    not tracked.

12. **Today's planned session** (`10_train` plan banner, `09_my_plan` day strip) — confirmed
    during Phase 3: `workout_plans.plan` is `{ days: [{ day_label, focus, exercises }] }` with
    no plan-day → weekday mapping, so "today's session" is not derivable. The banner names the
    split instead. Needs either a weekday field per plan day, or a plan start-date anchor to
    rotate days against.

Resolved since this list was written: #1 (Phase 8), #2 and #3 (Phase 7), #8/#9/#10 (Phase 9).
The numbering is kept stable rather than reflowed, so earlier notes still point at the right item.

---

## Phase 9 — Streak poster, volume trend, per-meal emoji ✅

The last three deferred items that had real product value. All three were "the UI exists, the
data behind it does not".

### #8 — Shareable streak image

`src/app/utils/streak-share-image.util.ts` renders a 1080×1350 poster on a `<canvas>` and hands
it to the OS share sheet as a PNG file. Text sharing is gone: a line of text is not worth
sharing, and it was the image that carried the app.

- **Canvas 2D, not a DOM-to-image library.** No dependency, no external fetch, identical in the
  Android WebView. `html2canvas` and friends re-implement CSS layout and get `backdrop-filter`,
  gradients and emoji wrong — and the poster is a different composition from the page anyway.
- **Poster, not screenshot.** One enormous numeral (320px Poppins with the apricot glow), the
  week's dots underneath as the receipt that proves it, best-run/days-logged stats, and a quiet
  wordmark strip. Same tokens as the page — canvas gradient stops, apricot ramp, `--vox-on-apricot`
  for the check inside a dot, the grain overlay — so the two read as one object at two sizes.
- **The hero is measured, then centred** in the band above the footer. A cursor-from-the-top
  layout left a growing hole for a one-line headline and crowded the dots on a three-line one,
  and the headline length varies by milestone. Glyph boxes, not font sizes: a 320px numeral is
  ~232px of cap height, and laying out against the font size leaves a gap under every element.
- **Tracked labels are drawn glyph by glyph.** `ctx.letterSpacing` exists only in newer engines
  and the WebView version is whatever the device shipped with — a silently ignored property
  would collapse every uppercase label in the poster.
- **Fonts are awaited before the first `fillText`.** Canvas takes no part in CSS font loading, so
  drawing early falls back to the system face and every measurement — and so the whole layout —
  comes out wrong.
- **Grain is seeded** (mulberry32), so re-sharing the same streak produces a byte-identical image.
- Share path: `navigator.canShare({ files })` → `navigator.share`. `canShare` is the only reliable
  signal, because a WebView can support `share()` and reject file payloads. Where files are not
  accepted (desktop, older WebViews) the poster downloads instead, so the user still gets it.
  The CTA carries its own loading state — rendering takes a beat.

### #9 — "You're trending up"

Migration `0008_weekly_volume_series.sql`: `get_weekly_volume_series()`, one indexed aggregate
over `exercise_volume_kg()` (from 0007), grouped by ISO week.

- **Server-side, because volume lives in `set_lines`** — the JSONB column every list query
  deliberately omits because it is the expensive one. Pulling months of it into the browser to
  sum it is exactly the cost that omission was avoiding.
- **The RPC returns the series, not the verdict.** Rolling-window arithmetic is easier to get
  right, and to unit-test, in TypeScript; a few hundred `{week_start, volume_kg}` rows is a few
  KB after years of logging. `computeVolumeTrend` in `volume-trend.util.ts`, 10 specs.
- **Weeks with no volume are densified to zero.** The RPC only returns weeks that have data, so
  a naive "last four entries" read would compare the last four *logged* weeks and report growth
  across a two-month layoff. That regression is pinned by a spec.
- **A percentage needs a baseline**: coming back from a blank block is real progress, but "+∞%"
  is not a claim, so the nudge stays quiet until there is something to divide by. It also needs
  two full windows of history, and a move of at least 5% — 1–2% between four-week blocks is one
  extra set of squats, and a banner that fires on noise stops being read.
- **No "down" state.** The mockup has none, and a banner telling someone their training is
  shrinking is a nag, not a nudge. A flat or falling trend renders nothing and the volume chart
  directly below it speaks for itself.
- Placement: Progress, immediately above "This week's volume" — claim and evidence in one glance.
  Included in the page's load gate so a whole banner cannot drop in after the page has settled.
- `vox-progress-nudge` now registers its own three ionicons. It was relying on whichever host
  page happened to be visited first, so landing directly on `/progress` showed an empty tile.

### #10 — Per-meal emoji

Migration `0009_diet_log_emoji.sql`: nullable `diet_logs.emoji`.

- Both prompts (and both edge-function SYSTEM blocks, redeployed) now ask for one dish-specific
  glyph. Verified live: ramen → 🍜, and a six-meal suggestion set came back
  🍚 / 🧀 / 🥢 / 🍜 / 🥣 / 🍛 rather than six identical icons.
- **Validated like any other model output.** `normalizeMealEmoji` rejects anything with ASCII
  letters or digits (prose, a refusal, a fenced answer) or more than eight code points, and
  requires an `Extended_Pictographic` character. A rejection stores null, which is why the
  column is nullable.
- `mealEmoji()` in `meal-display.util.ts` is the single resolution point: the model's glyph where
  there is one, the meal-type glyph otherwise. `vox-meal-row` had its own copy of the meal-type
  table; it now shares this one. Rows logged before the column existed keep working unchanged.
- The suggestion and estimate cards on `/log-diet` show the glyph too — that is where it is first
  seen, and it makes a six-meal list scannable by icon.