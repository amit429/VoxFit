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
    not tracked.

12. **Today's planned session** (`10_train` plan banner, `09_my_plan` day strip) — confirmed
    during Phase 3: `workout_plans.plan` is `{ days: [{ day_label, focus, exercises }] }` with
    no plan-day → weekday mapping, so "today's session" is not derivable. The banner names the
    split instead. Needs either a weekday field per plan day, or a plan start-date anchor to
    rotate days against.
