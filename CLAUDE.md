# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VoxFit is a voice-first fitness logging app: users speak a workout or meal, Gemini 2.5 Flash structures it into typed data, the user reviews/edits, and it's saved to Supabase. Angular 20 (standalone components, signals) + Ionic Angular 8 + Tailwind v4, shipped as a mobile-web PWA and an Android app via Capacitor 8.

## Commands

```bash
npm start                    # dev server (uses environment.dev.ts via file replacement)
npm run build:dev            # dev build → www/
npm run build:prod           # prod build → www/
npm test                     # karma/jasmine, watches by default (singleRun: false)
npm run lint                 # ng lint (angular-eslint)

npm run android:prepare:dev  # build:dev + cap sync android
npm run android:run:dev      # build, sync, and run on device/emulator
npm run android:live:dev     # live-reload build on device (-l --external)
```

There's effectively one spec file in the repo today (`app.component.spec.ts`) — no established per-service/per-component test suite to match conventions against. `ng test -- --include=<path>` scopes a single-file run if you add one.

### Environment setup (required before `npm start` will work)

`src/environments/environment.ts` is a committed stub that just re-exports `environment.demo`; Angular's `fileReplacements` (angular.json) swap in `environment.dev.ts` / `environment.prod.ts` for real builds. `environment.dev.ts` is git-ignored — copy it from `environment.demo.ts` and fill in `supabaseUrl`, `supabaseAnonKey`, `geminiApiKey` before running anything locally. `useGeminiEdgeFunction: true` routes AI calls through Supabase Edge Functions instead of calling Gemini directly from the client — that's the production path; the direct-call path exists mainly for local iteration without deployed functions.

### MCP servers wired into this repo

`.mcp.json` connects `supabase` (project `nmjtvqpuepbkddruvlix`, read_only=false — schema/migration/log tools operate on the real project, not a local stack) and `lovable`. Prefer the `mcp__supabase__*` tools over asking the user to paste SQL results when inspecting schema, logs, or advisors.

## Architecture

### Path aliases and imports

`@/*` maps to `src/*` (tsconfig `paths`). All type declarations live under `src/app/models/`, one file per domain (`workout-extract`, `workout-journal`, `diet-log`, `diet-meals`, `nutrition`, `profile`, `user`, `password`, `workout-display`, `workout-exercise-draft`), re-exported through `src/app/models/index.ts`. Import from `@/app/models`, not individual model files — the barrel is the contract.

### Routing & auth guards (`src/app/app.routes.ts`, `src/app/guards/auth.guards.ts`)

Everything is lazy-loaded standalone components (`loadComponent`). Four guards compose the auth/onboarding state machine, all awaiting `auth.whenReady` first so routing never races Supabase session restoration:
- `guestGuard` — welcome/login/register/forgot-password; signed-in users get redirected to `/tabs/home` (or `/auth/onboarding` if `onboarding_completed` is false).
- `authGuard` — requires *some* session only. Used for `reset-password` deliberately instead of `guestGuard`, because a user arriving via the emailed recovery link already has a session and `guestGuard` would bounce them away.
- `onboardingPageGuard` — the onboarding screen itself; requires signed-in + not-yet-onboarded.
- `onboardingCompleteGuard` — everything under `/tabs`, plus `/voice`, `/log-diet`, `/settings`; requires signed-in + onboarded.

When adding a new top-level route, decide which of these four states it needs rather than reaching for a generic `authGuard` by default.

### Services layer (`src/app/services/`)

- `SupabaseService` — single `SupabaseClient` instance. Auth uses a no-op `lock` override instead of the default `navigator.locks` — that default conflicts with Zone.js and throws `NavigatorLockAcquireTimeoutError` → blank screen. Don't remove this without testing session refresh under Zone.js.
- `AuthService` — owns the session/profile signals (`session()`, `profile()`) and `whenReady`/`refreshProfile()` that the guards depend on.
- `GeminiWorkoutExtractService`, `GeminiDietMealsService` — each supports both `extractViaEdgeFunction` (calls the matching Supabase Edge Function) and a direct-fetch fallback gated by `environment.useGeminiEdgeFunction`. Both paths converge on the same parse/normalize functions so callers get an identically-shaped result regardless of transport. When adding a new AI feature, follow this same triple: an Edge Function in `supabase/functions/`, a matching prompt builder in `src/app/prompts/`, and a service with both transports — that's the established pattern (see `docs/PRD-ai-coach-features.md` for a fully worked-out example of extending it).
- `WorkoutJournalService`, `WorkoutSessionLogService`, `DietLogService`, `NutritionDashboardService` — domain read/write + derived-stats services consumed by pages.

AI parse functions are defensive by construction: Gemini output is untrusted JSON, so every field goes through explicit `normalize*`/`nullable*` coercion with sane fallbacks rather than trusting the shape. Match this when parsing new AI responses instead of casting.

### Data flow

```
Voice input → Speech Recognition (Web Speech API / Capacitor native on Android)
→ transcript → Gemini (edge function or direct) → structured JSON
→ normalize/parse → user review (vox-card, editor modals) → Supabase write
→ journal/dashboard services re-derive stats → charts, streaks, heatmap
```

### Supabase (`supabase/functions/`, tables)

Edge Functions (Deno): `extract-workout`, `suggest-diet-meals`, `log-food` — each takes voice-derived input and returns structured JSON via Gemini server-side (keeps the API key off the client in production). Tables: `user_profiles`, `workout_sessions`, `exercises_logged`, `diet_logs`, all RLS-scoped to `auth.uid()` (`exercises_logged` via a join through `workout_sessions` ownership). `exercises_logged.set_lines` and `workout_sessions.raw_transcript`/coach fields are JSONB — the project's convention is real columns for whatever the UI filters/queries on, JSONB for AI-shaped structured content that's read back whole (see the `workout_plans` design in the PRD for the same pattern applied to a new table).

`supabase/` is excluded from the main `tsconfig.json` — it's a separate Deno runtime, not part of the Angular compilation unit. Don't expect `@/*` aliases or Angular types inside `supabase/functions/`.

## Frontend design system

Linear-inspired dark UI, tokens as CSS custom properties in `src/theme/variables.scss`. When building or touching UI, invoke the `frontend-design` skill for general execution guidance, but the concrete rules for *this* app are:

- **Single accent discipline**: `#5e6ad2` (lavender) is the only accent — never as a card fill or gradient, reserved for CTAs/focus rings/brand marks. Hierarchy comes from the surface ladder (`canvas` → `surface-1..4`) and hairline borders, not shadows or extra colors.
- **No box-shadows, no pill CTAs** — buttons use `md` radius, not `pill` (pill radius is reserved for badges/chips).
- **Typography**: Inter for text (display ≤600 weight, -0.02em tracking), JetBrains Mono for numeric displays (reps, weights, macros) so figures stay tabular. Both self-hosted via `@fontsource`, not Google Fonts CDN.
- **Icons**: ionicons via the `vox-icon` wrapper component (ties size/tone to the token system) — don't drop raw `ion-icon` or emoji into new UI. The one exception is emoji that *is* AI-generated data (e.g. a meal suggestion's emoji), which stays as-is.
- **Page shell convention — this is the one new contributors most often get backwards**: `vox-page-header` + `vox-card` are reserved for the auth flow only (welcome, login, register, onboarding). Every other screen — tabs and standalone routes like `/voice`, `/log-diet`, `/settings` — uses a plain `<header>` with the `vox-standalone-page` / `tab-page-content` classes plus Tailwind utilities directly. Don't reach for `vox-page-header` on a non-auth page.
- Shared component library lives in `src/app/components/` (`vox-card`, `vox-badge`, `vox-icon`, `vox-page-header`, plus feature-specific ones like the exercise editor/review modals) — check there before building a one-off equivalent.

## Angular/Ionic conventions

- All components standalone; `@angular-eslint/component-class-suffix` enforces `Page` (routed) or `Component` (shared) suffixes, and `component-selector` enforces `app-`/`vox-` kebab-case prefixes — new files should follow whichever suffix/prefix matches their role.
- State is Angular signals throughout (`session()`, `profile()`, etc.) — no NgRx/service-level RxJS state store to keep in sync with.
- `strict: true` plus `noPropertyAccessFromIndexSignature`, `strictTemplates`, `strictInjectionParameters` are all on — untyped `any`/index-signature shortcuts will fail the build, not just lint.
