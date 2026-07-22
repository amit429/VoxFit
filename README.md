# VoxFit — Voice-First Fitness Logging for the Modern Gym

![VoxFit](https://img.shields.io/badge/platform-mobile--web-blue) ![Angular](https://img.shields.io/badge/framework-Angular%2020-red) ![Supabase](https://img.shields.io/badge/backend-Supabase-3ecf8e) ![Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-gold)

**Speak your workout. Track your progress. Effortlessly.**

VoxFit is a voice-first fitness logging application designed for gym-goers and fitness communities who want to log their workouts and meals without typing. Just speak naturally — "did three sets of ten twenty thirty on bench" — and VoxFit's AI parses it into structured workout data in seconds.

## Features

🎙️ **Voice-First Workout Logging**
- Hold-to-talk mic interface for capturing workout sessions
- AI-powered parsing (Gemini 2.5 Flash) converts natural speech into sets, reps, weights, cardio segments — even messy, repeated, or garbled mobile speech-to-text output
- Review & edit AI-extracted data before saving — your data, your control

🍽️ **Voice-Driven Meal Logging**
- Tap-to-speak meal suggestions based on your cravings and pantry
- AI generates meal suggestions with macro breakdowns
- Track calories and macros (Protein, Carbs, Fats) against daily targets
- Smart recommendations against your nutrition goals

📊 **Workout Analytics & History**
- Weekly workout volume tracking with bar charts
- Streak counter to stay motivated (days, weekly dots)
- Personal records (PR) badges and flagged exercises
- Mood/energy tracking per session for holistic logging
- Calendar heatmap of activity to visualize your consistency

⚙️ **Mobile-First, Offline-Ready**
- Responsive mobile-web app (desktop fallback supported)
- Progressive Web App (PWA) with offline caching
- One-codebase deployment to browsers and Play Store (via Capacitor)
- Integrates with native speech recognition (web & Android)

🎨 **Modern Dark UI**
- Linear-inspired design system (dark canvas, hairline borders, single lavender accent)
- Self-hosted fonts (Inter for text, JetBrains Mono for stats)
- Tailwind CSS v4 for rapid, consistent styling
- Fully accessible component library (vox-card, vox-badge, vox-icon)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Angular 20 (standalone components, signals), Ionic Angular 8, Tailwind CSS v4 |
| **Mobile/Desktop** | Capacitor 8 (native bridge to Android & web), Progressive Web App |
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions) |
| **AI** | Google Gemini 2.5 Flash (workout parsing, meal suggestions) |
| **Fonts** | Inter 500/600/700, JetBrains Mono 400/500 (self-hosted via @fontsource) |
| **Icons** | Ionicons 7 |
| **State** | Angular signals (lightweight, reactive) |

## Getting Started

### Prerequisites

- **Node.js** 18+ (npm 9+)
- **Supabase** account (free tier available)
- **Google Gemini API** key
- **Android SDK** (optional, for native development)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/voxfit.git
cd voxfit

# Install dependencies
npm install

# Set up environment
cp src/environments/environment.demo.ts src/environments/environment.dev.ts
# Edit environment.dev.ts with your Supabase URL, key, and Gemini API key
```

### Environment Setup

Edit `src/environments/environment.dev.ts`:

```typescript
export const environment = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY',
  geminiApiKey: 'YOUR_GEMINI_API_KEY',
  useGeminiEdgeFunction: true, // use Supabase Edge Function instead of client-side Gemini
};
```

### Development Server

```bash
# Start dev server (mobile viewport recommended)
npm start

# Build for production
npm run build:prod

# Test on Android (with Capacitor)
npm run android:run:dev
```

## Architecture

### Pages & Routes

- **Auth**: Welcome, Login, Register, Onboarding (profile setup)
- **Home**: Dashboard with streak, today's workout, nutrition macros
- **Voice Log** (`/voice`): Hold-to-talk workout capture with AI review
- **Workout** (`/tabs/workout`): Session history, list/detail views, weekly volume chart
- **Diet Voice Log** (`/log-diet`): Tap-to-speak meal suggestions
- **Diet** (`/tabs/diet`): Meal log and macro tracking
- **Profile** (`/tabs/profile`): Activity heatmap, goals, user settings

### Data Flow

```
User Voice Input
    ↓
Speech Recognition (Web/Android native)
    ↓
Transcript → Gemini AI (Edge Function)
    ↓
Structured Data (exercises, sets, reps, weight)
    ↓
User Review/Edit (vox-card, modals)
    ↓
Save to Supabase (PostgreSQL)
    ↓
Analytics & History (charts, heatmap, stats)
```

### Services

- **AuthService**: Supabase auth session & profile management
- **VoiceSessionService**: Native/Web speech recognition abstraction
- **GeminiWorkoutExtractService**: Workout transcript parsing
- **GeminiDietMealsService**: Meal suggestion generation
- **WorkoutJournalService**: Session queries, streak computation, volume tracking
- **DietLogService**: Meal logging & macro aggregation
- **SupabaseService**: Supabase client initialization

### Components

**Shared UI (Design System)**
- `vox-card`: Surface wrapper with variants (resting/raised/interactive)
- `vox-badge`: Status pills, tags, semantic color coding
- `vox-icon`: Ionicons wrapper with size/tone token binding
- `vox-btn-*`: Button classes (primary, secondary, ghost)

**Feature Components**
- `session-exercise-review-card`: Accordion UI for reviewing parsed exercises
- `exercise-editor-modal`: Bottom-sheet for editing extracted exercise data
- `exercise-sets-preview-table`: Read-only table of parsed sets/reps/weights

## Design System

VoxFit uses a **Linear-inspired dark design system** (2024 redesign):

| Token | Value | Use |
|-------|-------|-----|
| Canvas | `#0a0a0c` | App background |
| Surface-1 | `#101113` | Toolbar, tab bar |
| Surface-2 | `#16171a` | Resting cards |
| Surface-3 | `#1b1c1f` | Raised cards, modals |
| Surface-4 | `#212226` | Active/hover state |
| Primary Accent | `#5e6ad2` | CTA, focus ring, brand only |
| Success | `#27a644` | Positive indicators |
| Warning | `#d4a72c` | Caution, macro warnings |
| Danger | `#e5484d` | Destructive actions, errors |

**Typography** (Inter + JetBrains Mono)
- Display: 600 weight max, -0.02em tracking
- Body: 400 weight, -0.05px tracking
- Mono: Numeric displays (reps, weights, macros) for tabular alignment

**Spacing**: 4px base unit (4/8/12/16/24/32/48/96px tokens)  
**Radii**: xs(4px) → sm(6px) → md(8px) → lg(12px) → xl(16px) → pill(9999px)

**Rules**
- Single scarce accent — never as card fill or gradient
- No pill-shaped CTAs (md radius only)
- No box-shadows — hierarchy via surface ladder + hairlines
- Emoji chrome → ionicons; AI-generated data emoji stays

## Project Structure

```
voxfit/
├── src/
│   ├── app/
│   │   ├── pages/          # Route components (home, voice-log, diet, workout, auth, profile)
│   │   ├── components/     # Shared UI (vox-card, vox-badge, exercise review, etc.)
│   │   ├── services/       # Auth, voice, Gemini, Supabase, analytics
│   │   ├── models/         # TypeScript interfaces (workout extract, diet meals, user)
│   │   ├── guards/         # Route guards (auth, onboarding)
│   │   ├── utils/          # Formatters, mappers (workout display, exercise parsing)
│   │   ├── prompts/        # Gemini system prompts (workout parser, meal suggester)
│   │   └── data/           # View-model types, small fallback display defaults
│   ├── theme/              # Design tokens (variables.scss), shared styles
│   ├── global.scss         # Tailwind config, Ionic imports, fonts
│   └── index.html          # PWA manifest, viewport, meta tags
├── android/                # Capacitor Android project
├── supabase/
│   └── functions/          # Edge Functions (extract-workout, suggest-diet-meals)
├── capacitor.config.ts     # Capacitor config (appId: com.voxfit.app)
└── angular.json            # Angular CLI workspace config
```

## Deployment

### Web (PWA)
```bash
npm run build:prod
# Deploy www/ directory to Vercel, Netlify, or any static host
```

### Android (Play Store)
```bash
npm run android:prepare:prod
# In Android Studio: Build → Generate Signed Bundle/APK
# Follow Play Store submission flow
```

## Development Workflow

1. **Local dev**: `npm start` → browser mobile viewport (Chrome DevTools)
2. **Component changes**: Edit `.ts`/`.html`/`.scss`, save → auto-reload
3. **Design token changes**: Edit `src/theme/variables.scss` → impacts all screens
4. **Voice testing**: Use web Speech API in Chrome, or native Android emulator/device
5. **Build verification**: `npm run build:dev` (2 min)
6. **Android smoke test** (before landing): `npm run android:run:dev`

## API & Services

### Supabase Tables

- `user_profiles` — User info, goals, macro targets, onboarding status
- `workout_sessions` — Logged workouts (date, mood, energy, raw/cleaned transcript, coach summary)
- `exercises_logged` — Exercise rows per session (name, type, PR flag, `set_lines` JSONB for per-set reps/weight/duration/distance)
- `diet_logs` — Meal entries (date, meal type, macros, notes)

All four tables have Row Level Security enabled, scoped to `auth.uid()` (directly on `user_id`/`id` for the first three, via a `workout_sessions` ownership join for `exercises_logged`).

### Gemini Edge Functions

- **`extract-workout`** — Deno runtime, POST transcript → structured `WorkoutExtractResult`
- **`suggest-diet-meals`** — Deno runtime, POST pantry/cravings → meal suggestions with macros

## Contributing

Contributions welcome! Follow these guidelines:

1. **Branches**: Feature branches off `main` (e.g., `feat/voice-improvements`)
2. **Commits**: Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`)
3. **PRs**: Describe the "why" — what user problem does this solve?
4. **Tests**: Add unit tests for new services (auth, gemini, journal)
5. **Mobile testing**: Verify on real/emulated Android before landing

## Known Limitations & Roadmap

### Current
- Android platform only (iOS via Capacitor not tested)
- Speech recognition depends on device/browser support
- Gemini API costs scale with usage (consider rate-limiting or quotas)

### Planned
- iOS support (Capacitor bridge ready, just needs testing)
- Offline-first workout logging (service worker + IndexedDB sync)
- Social features (share sessions, friend leaderboards)
- Wearable integration (Apple Watch, Wear OS)
- Advanced analytics (ML-based exercise classification, form feedback via video)

## License

MIT — see LICENSE file

## Support & Feedback

Found a bug? Have a feature idea? [Open an issue](https://github.com/yourusername/voxfit/issues) or reach out via [email/Discord/etc.].

---

**Built for the modern gym-goer who speaks faster than they type.** 🎙️💪
