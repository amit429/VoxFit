# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VoxFit is a voice-first fitness logging app: users speak a workout or meal, Gemini 2.5 Flash structures it into typed data, the user reviews/edits, and it's saved to Supabase. Angular 20 (standalone components, signals) + Ionic Angular 8 + Tailwind v4, shipped as a mobile-web PWA (Cloudflare) and an Android app via Capacitor 8.

## Commands

```bash
npm start                    # dev server (uses environment.dev.ts via file replacement)
npm run build:dev            # dev build → www/
npm run build:prod           # prod build → www/ (prebuild runs scripts/generate-prod-env.js)
npm test                     # karma/jasmine, watches by default (singleRun: false)
npm run lint                 # ng lint (angular-eslint)

npm run android:prepare:dev  # build:dev + cap sync android
npm run android:run:dev      # build, sync, and run on device/emulator
npm run android:live:dev     # live-reload build on device (-l --external)

npm run deploy               # wrangler deploy (Cloudflare; config in wrangler.jsonc)
```

Native changes need a `cap sync` to reach the device — a pure CSS/TS fix verified in the browser is **not** in the APK until `npm run android:prepare:dev` runs. Say so when handing off a fix for a native-only symptom.

### Environment setup (required before `npm start` will work)

`src/environments/environment.ts` is a committed stub that just re-exports `environment.demo`; Angular's `fileReplacements` (angular.json) swap in `environment.dev.ts` / `environment.prod.ts` for real builds. `environment.dev.ts` is git-ignored — copy it from `environment.demo.ts` and fill in `supabaseUrl`, `supabaseAnonKey`, `geminiApiKey` before running anything locally. `useGeminiEdgeFunction: true` routes AI calls through Supabase Edge Functions instead of calling Gemini directly from the client — that's the production path; the direct-call path exists mainly for local iteration without deployed functions.

### MCP servers wired into this repo

`.mcp.json` connects `supabase` (project `nmjtvqpuepbkddruvlix`, read_only=false — schema/migration/log tools operate on the real project, not a local stack) and `lovable`. Prefer the `mcp__supabase__*` tools over asking the user to paste SQL results when inspecting schema, logs, or advisors.

## Architecture

### Path aliases

`@/*` maps to `src/*` (tsconfig `paths`). Import app code as `@/app/...` and environments as `@/environments/environment`.

### Models — one model per file

All type declarations live under `src/app/models/`, one **model** per file, the file named after it (`user-profile.model.ts` → `UserProfile`).

"One model per file" means one *concept*, not one *export*. A model's own supporting types live beside it in the same file:

- the string unions only that model uses (`workout-plan-row.model.ts` holds `WorkoutPlanStatus`, `WorkoutPlanSource`, `WorkoutPlanRow`)
- nested shapes that only exist inside it (`workout-plan-content.model.ts` holds `WorkoutPlanExercise` → `WorkoutPlanDay` → `WorkoutPlanContent`)
- companion consts describing the type (`workout-plan-focus.model.ts` holds `WorkoutPlanFocus` plus its ordering and label maps)

Two models that make sense independently never share a file. A type referenced by an unrelated model gets its own file and is imported from that sibling directly (`workout-exercise-extract.model.ts` imports `ExerciseTypeDb` from `exercise-type-db.model.ts`).

Everything is re-exported through `src/app/models/index.ts`. **Import from `@/app/models`, not individual model files — the barrel is the contract.** Model files themselves import siblings by path, since the barrel would be circular.

### Routing & auth guards (`src/app/app.routes.ts`, `src/app/guards/auth.guards.ts`)

Everything is lazy-loaded standalone components (`loadComponent`). Four guards compose the auth/onboarding state machine, all awaiting `auth.whenReady` first so routing never races Supabase session restoration:

- `guestGuard` — welcome/login/register/forgot-password; signed-in users get redirected to `/tabs/home` (or `/auth/onboarding` if `onboarding_completed` is false).
- `authGuard` — requires *some* session only. Used for `reset-password` deliberately instead of `guestGuard`, because a user arriving via the emailed recovery link already has a session and `guestGuard` would bounce them away.
- `onboardingPageGuard` — the onboarding screen itself; requires signed-in + not-yet-onboarded.
- `onboardingCompleteGuard` — everything under `/tabs`, plus `/voice`, `/log-diet`, `/settings`, `/progress`, `/streak`; requires signed-in + onboarded.

When adding a new top-level route, decide which of these four states it needs rather than reaching for a generic `authGuard` by default.

### Services layer (`src/app/services/`)

- `SupabaseService` — single `SupabaseClient` instance. Auth uses a no-op `lock` override instead of the default `navigator.locks` — that default conflicts with Zone.js and throws `NavigatorLockAcquireTimeoutError` → blank screen. Don't remove this without testing session refresh under Zone.js.
- `AuthService` — owns the session/profile signals (`session()`, `profile()`) and `whenReady`/`refreshProfile()` that the guards depend on.
- `Gemini*Service` (`gemini-workout-extract`, `gemini-diet-meals`, `gemini-workout-plan`, `gemini-checkin`) — the AI transport layer, see below.
- Domain read/write + derived-stats services consumed by pages: `WorkoutJournalService`, `WorkoutSessionLogService`, `WorkoutPlanService`, `DietLogService`, `NutritionDashboardService`, `ProgressCoachService`, `BadgeService`, `StreakMilestoneService`, `VoiceSessionService`, `DeepLinkService`.

### Utils (`src/app/utils/`)

Pure functions, no Angular DI. Two suffixes, and the distinction is meaningful:

- `*.util.ts` — derivation, formatting, and normalization (`training-stats.util.ts`, `workout-display.util.ts`).
- `*.mapper.ts` — converts between one shaped type and another (`exercise-logged.mapper.ts`, `workout-extract-ui.mapper.ts`).

This is where the test suite actually lives — see Testing.

### Data flow

```
Voice input → Speech Recognition (Web Speech API / Capacitor native on Android)
→ transcript → Gemini (edge function or direct) → structured JSON
→ normalize/parse → user review (vox-card, editor modals) → Supabase write
→ journal/dashboard services re-derive stats → charts, streaks, heatmap
```

### Supabase

Edge Functions (Deno, `supabase/functions/`): `extract-workout`, `suggest-diet-meals`, `log-food`, `generate-workout-plan`, `generate-checkin`, `classify-exercise-muscles`, `delete-account`.

Tables: `user_profiles`, `workout_sessions`, `exercises_logged`, `diet_logs`, `workout_plans`, all RLS-scoped to `auth.uid()` (`exercises_logged` via a join through `workout_sessions` ownership).

Column convention: **real columns for whatever the UI filters or queries on, JSONB for AI-shaped structured content that's read back whole** — `exercises_logged.set_lines`, `workout_sessions.raw_transcript`, `workout_plans.plan`.

`supabase/` is excluded from the main `tsconfig.json` — it's a separate Deno runtime, not part of the Angular compilation unit. Don't expect `@/*` aliases or Angular types inside `supabase/functions/`.

## Adding an AI feature

The established pattern is a **triple**, and all three pieces move together:

1. an Edge Function in `supabase/functions/<name>/`
2. a matching prompt builder in `src/app/prompts/<name>.prompt.ts`
3. a service exposing both transports, gated by `environment.useGeminiEdgeFunction`

The two prompt copies (client `src/app/prompts/*.prompt.ts` and server `supabase/functions/*/prompt.ts`) must be kept in sync — each carries a header comment naming its counterpart. Both transports converge on the same parse/normalize function so callers get an identically-shaped result regardless of path.

Worked examples live in `docs/superpowers/plans/` and `docs/superpowers/specs/`.

### Parsing model output

Gemini output is untrusted JSON. Every field goes through explicit `normalize*`/`nullable*` coercion with sane fallbacks rather than being cast. Concretely: enums fall back to a safe member, numbers that must be positive integers drop the whole record when they aren't, and strings are clamped in the UI regardless of any length the prompt asked for.

**Normalize on read, not just on write.** Rows persisted before a JSONB shape changed are upgraded by the same normalizer when they are loaded (see `normalizeWorkoutPlanContent` + `upgradeRow` in `workout-plan.service.ts`). This is how shape changes ship without a data migration, and it keeps "old shape or new shape?" branching out of the components.

## Frontend design system

Linear-inspired dark "Dusk" system, tokens as CSS custom properties in `src/theme/variables.scss`. When building or touching UI, invoke the `frontend-design` skill for general execution guidance; the concrete rules for *this* app are below.

### Accents have one job each

`#887bfc` periwinkle = brand/AI/action · jade = selected/affirmative · apricot = streak/energy · rose = physical notes and destructive actions · slate = secondary data series. Never pick an accent because it looks good in that spot. Rose is deliberately **not** an alert red — physical-flag UI stays observational, no warning triangles or clinical iconography.

Hierarchy comes from the surface ladder (`surface-1..4`) and hairline borders, not shadows. No box-shadows except genuinely floating elements; no pill CTAs (buttons use `md` radius — pill is for badges/chips).

### Typography

Poppins for text/display (headlines at 600, never 700 — the lighter weight is what separates this from shouty mass-market fitness apps), JetBrains Mono for **all** numerics so figures stay tabular. Both self-hosted via `@fontsource`. A countdown or measurement is mono; a sentence never is, even when it replaces one.

### Page shell convention — the thing new contributors most often get backwards

`vox-page-header` + `vox-card` are reserved for the **auth flow only** (welcome, login, register, onboarding). Every other screen — tabs and standalone routes like `/voice`, `/log-diet`, `/settings` — uses a plain `<header>` with the `vox-standalone-page` / `tab-page-content` classes plus Tailwind utilities. Don't reach for `vox-page-header` on a non-auth page.

### Atmosphere layers must be viewport-fixed

Pages layer `.vx-atmo` (blurred accent blobs) and `.vx-grain` over the shared canvas gradient. Both are `position: fixed` with an explicit `height: 100vh` in `vox-ui.scss`, and that is **load-bearing, not stylistic**:

as `position: absolute` they sat inside ion-content's scrolling box, so they scrolled away with the content and their `overflow: hidden` sliced the 70px-blurred blobs along a hard horizontal edge that travelled up the screen — a visible line splitting the page. `height: 100vh` rather than `bottom: 0` matters on tab pages, where the containing block ends at the top of the tab bar and would put that clip edge under the bar's deliberately transparent top.

Per-screen blob placement stays per-page (each screen gets its own arrangement so screens feel distinct while staying related), but never change the positioning scheme.

### App shell height — `dvh`, never `100%`

`html, body` are sized `height: 100%` then `height: 100dvh` (the `100%` line is a
deliberate fallback and must stay first). `100%` resolves against the initial
containing block, which on a mobile browser is the **large** viewport — the
height with the URL bar hidden — so the shell's bottom edge, and with it
`ion-tab-bar`, sat below the visible area whenever the URL bar was showing. The
bar vanished entirely on scroll up and swung back on scroll down.

All three viewport units were tried against real device screenshots, and the
choice is not arbitrary:

| unit | URL bar shown | URL bar hidden |
|---|---|---|
| `100%` / `lvh` | bar pushed off screen | flush |
| `svh` | flush | bar stranded above the bottom, gap beneath |
| `dvh` | flush | flush |

`dvh` is the only one flush in both states — it tracks the current viewport, so
the bar follows browser chrome as it animates, the way a native bottom bar does.
`body` carries `--vox-canvas-gradient-end` as a backstop so the sliver exposed
mid-animation continues the page ramp instead of flashing black. Don't
"simplify" any of this back to `100%`.

### Scrolling

`ion-content::part(scroll)` sets `overscroll-behavior-y: none`. **`contain` is not sufficient** — per spec it only stops scroll *chaining*; the local bounce is deliberately preserved. The scroller exactly fills the viewport, which is the criterion Chrome uses to promote it to the implicit *root* scroller, so its bounce stretches the root layer and drags the statically-positioned `ion-tab-bar` with it. Nothing in the app uses `ion-refresher`, so suppressing the gesture costs no affordance.

### Tab bar

`ion-tab-bar` height lives in `src/app/pages/tabs/tabs.page.scss`; `.tab-page-content --padding-bottom` in `src/global.scss` must clear it. **Keep the two in step** — over-padding leaves a dead band above the bar. The tab button (not the bar's `min-height`) sets the real floor, so it is what keeps the tap target ≥44px.

### Icons

ionicons via the `vox-icon` wrapper (ties size/tone to the token system) — don't drop raw `ion-icon` or emoji into new UI. The one exception is emoji that *is* AI-generated data (e.g. a meal suggestion's emoji).

### Shared components (`src/app/components/`, 42 of them)

Check here before building a one-off equivalent: `vox-card`, `vox-badge`, `vox-icon`, `vox-skeleton`, `vox-segmented`, `vox-stat-tile`, `vox-confirm-dialog`, plus feature-specific editors, modals and charts.

- Destructive confirmations use `vox-confirm-dialog` (the `.vox-centre-modal` shell), **not** Ionic's `alertController` — that paints platform chrome and lands looking borrowed.
- Focus keying for plan day types uses the global `.vox-focus-*` classes in `vox-ui.scss`. Those classes set **custom properties only**; the component decides what to paint with them, so "what colour is a legs day" is answered in exactly one place. Custom properties inherit through emulated encapsulation, so a global class on a host reaches that component's own styles.

### Tailwind v4 caveat

The installed tailwindcss/@tailwindcss-postcss (4.2.4) has a content-scanning bug: **any class containing `.`, `[`, `]`, or `/` silently fails to generate.** No arbitrary-value classes. Use the `.vx-*` escape hatches in `src/theme/vox-ui.scss`, or component SCSS, which sidesteps the issue entirely.

## Angular/Ionic conventions

- All components standalone. `@angular-eslint/component-class-suffix` enforces `Page` (routed) or `Component` (shared); `component-selector` enforces an `app-`/`vox-` kebab-case prefix. New files follow whichever matches their role.
- State is Angular signals throughout (`input()`, `output()`, `computed()`, `signal()`) — no NgRx, no service-level RxJS state store.
- **Shared components use `ChangeDetectionStrategy.OnPush`** (31 of 42 do); routed pages do not. Match the surrounding role when adding a file.
- `strict: true` plus `noPropertyAccessFromIndexSignature`, `strictTemplates`, `strictInjectionParameters` are all on — untyped `any`/index-signature shortcuts fail the build, not just lint. Index-signature access is `o['key']`, never `o.key`.
- Prefer `@if`/`@for`/`@switch` control flow with `track` on every loop.

## Testing

14 spec files, and the pattern is deliberate: **pure functions and services have specs; pages and most components do not.**

- `src/app/utils/*.util.spec.ts` — 6 specs over the pure derivation/formatting helpers
- `src/app/services/*.service.spec.ts` — 6 specs, concentrated on parsing/normalization and business rules
- one component spec (`coach-pointer-card`) and `app.component.spec.ts`

New pure logic — a normalizer, a mapper, a stats derivation — is expected to come with a spec. UI-only components are not.

```bash
npx ng test --watch=false --browsers=ChromeHeadless          # full run
npx ng test --watch=false --include=<path-to-spec>           # single file
```

Note `angular.json` loads only `src/theme/variables.scss` into the karma build, not `global.scss` — global utility classes aren't present in component style tests.

## Verifying UI work

There is no device farm here, so be precise about what was actually checked. The reliable loop for a visual or layout change: run `npm start`, drive it with the Playwright MCP tools at a mobile viewport, and **measure** (`getBoundingClientRect`, `getComputedStyle`) rather than eyeballing a screenshot. Ionic scroll state is read via `await ionContent.getScrollElement()`, not `document.scrollingElement` — the document itself does not scroll in this app.

If a route is behind a guard, a temporary unguarded harness route is fine — delete it and confirm `app.routes.ts` is byte-identical before finishing.

Effects that only exist on a real device (elastic overscroll, browser URL-bar resize, native status-bar chrome) **cannot** be reproduced headlessly. Fix the cause, state what was and wasn't verified, and ask the user to confirm on the device rather than claiming it works.
