import { Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { driver, type Driver, type DriveStep } from 'driver.js';
import type { TourKey } from '@/app/models';
import { AuthService } from '@/app/services/auth.service';
import { SpeechDemoService } from '@/app/services/speech-demo.service';
import { findSpokenWordIndex } from '@/app/utils/tour-word-highlight.util';

const WORKOUT_EXAMPLE =
  'Three sets of squats, sixty kilos for ten, seventy for eight, eighty for six. Legs felt strong.';
const MAKE_MEAL_EXAMPLE =
  "I've got chicken, spinach, and eggs. Craving something spicy, and I need more protein today.";
const ATE_MEAL_EXAMPLE = 'Two eggs, a bowl of oats, and a banana for breakfast.';

type SayContentKind = 'workout' | 'makeMeal' | 'ateMeal';

const SAY_CONTENT: Record<
  SayContentKind,
  { lead: string; categories: { icon: string; label: string; hint: string }[]; example: string }
> = {
  workout: {
    lead: 'No script — just mention what happened:',
    categories: [
      { icon: '🏋️', label: 'The exercise', hint: 'squats, bench, whatever you did' },
      { icon: '🔢', label: 'Sets, reps, weight', hint: 'three sets of ten at sixty kilos' },
      { icon: '💬', label: 'How it felt', hint: 'that last set was rough' },
      { icon: '🩹', label: 'Anything that hurt', hint: 'shoulder felt a bit off' },
    ],
    example: WORKOUT_EXAMPLE,
  },
  makeMeal: {
    lead: "Mention what's in your fridge, what you're craving, and any goal you're working toward:",
    categories: [
      { icon: '🥘', label: "What's in the fridge", hint: 'chicken, spinach, eggs' },
      { icon: '😋', label: "What you're craving", hint: 'something spicy today' },
      { icon: '🎯', label: 'Your goal', hint: 'need more protein today' },
    ],
    example: MAKE_MEAL_EXAMPLE,
  },
  ateMeal: {
    lead: 'Just describe the plate — VoxFit estimates the rest:',
    categories: [
      { icon: '🍽️', label: 'What you ate', hint: 'two eggs, oats, and a banana' },
      { icon: '📏', label: 'Roughly how much, if you know it', hint: 'a big bowl is fine too' },
    ],
    example: ATE_MEAL_EXAMPLE,
  },
};

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly auth = inject(AuthService);
  private readonly speech = inject(SpeechDemoService);
  private readonly router = inject(Router);

  /** Set by a Settings replay row before navigating; consumed once by the target page. */
  readonly pendingReplay = signal<TourKey | null>(null);

  private activeRun: { driverObj: Driver; forceBailout: () => void } | null = null;

  constructor() {
    // A tour's overlay is appended to document.body, outside Angular's router
    // outlet, so navigating away does not tear it down on its own — and per
    // the completion rule below, any non-click way the tour disappears counts
    // as a bail-out, not a completion.
    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe(() => this.activeRun?.forceBailout());
  }

  requestReplay(tour: TourKey): void {
    this.pendingReplay.set(tour);
  }

  /** Call on the target page; starts the tour unconditionally (bypassing hasSeen) if this tour was requested. */
  takeReplay(tour: TourKey): boolean {
    if (this.pendingReplay() !== tour) return false;
    this.pendingReplay.set(null);
    this.startFor(tour);
    return true;
  }

  maybeStartOrientation(): void {
    if (!this.hasSeen('orientation')) this.startFor('orientation');
  }

  maybeStartWorkout(): void {
    if (!this.hasSeen('workout')) this.startFor('workout');
  }

  maybeStartJournal(): void {
    if (!this.hasSeen('journal')) this.startFor('journal');
  }

  maybeStartMeal(): void {
    if (!this.hasSeen('meal')) this.startFor('meal');
  }

  maybeStartProfile(): void {
    if (!this.hasSeen('profile')) this.startFor('profile');
  }

  private hasSeen(tour: TourKey): boolean {
    const profile = this.auth.profile();
    // Profile not loaded yet is treated as "seen" — skip rather than risk
    // showing a tour against not-yet-known state.
    if (!profile) return true;
    switch (tour) {
      case 'orientation':
        return profile.tour_orientation_seen;
      case 'workout':
        return profile.tour_workout_seen;
      case 'journal':
        return profile.tour_journal_seen;
      case 'meal':
        return profile.tour_meal_seen;
      case 'profile':
        return profile.tour_profile_seen;
    }
  }

  private startFor(tour: TourKey): void {
    const steps =
      tour === 'orientation' ? this.orientationSteps()
      : tour === 'workout' ? this.workoutSteps()
      : tour === 'journal' ? this.journalSteps()
      : tour === 'meal' ? this.mealSteps()
      : this.profileSteps();
    this.run(tour, steps);
  }

  /**
   * Completion semantics: finishing through driver.js's own chrome (Done,
   * close button, overlay backdrop) marks the tour seen — unchanged from the
   * original spec. Clicking through to the real, spotlighted element itself
   * (e.g. actually tapping the mic, or a meal-mode card) is *not* a bail-out
   * — engaging with the exact thing a step points at is success, so the real
   * click's own handler is left to run untouched and the tour is marked seen
   * too. The only remaining way a tour disappears — a non-click navigation
   * (back button, deep link) — is the genuine bail-out: torn down, not
   * marked seen, so it fires again next visit.
   */
  private run(tour: TourKey, steps: DriveStep[]): void {
    let bailedOut = false;
    let claimedByRealClick = false; // a real click always wins a same-tick NavigationStart race
    let cleanup: (() => void) | null = null;

    const driverObj: Driver = driver({
      popoverClass: 'voxfit-tour',
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      stagePadding: 8,
      stageRadius: 16,
      /*
       * driver.js paints the dimming layer as an inline-styled SVG <path>
       * (fill + opacity set via JS), not the `.driver-overlay` CSS class —
       * a `background` rule on that class in driver-theme.scss has no
       * visual effect. Color and opacity both have to be set here.
       */
      overlayColor: '#08070d',
      overlayOpacity: 0.55,
      allowClose: true,
      overlayClickBehavior: 'close',
      smoothScroll: true,
      skipMissingElement: true,
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      steps,
      onHighlightStarted: (element) => {
        cleanup?.();
        cleanup = null;
        if (!(element instanceof HTMLElement)) return; // centered steps: nothing real to bail out to
        // The voice orb is round, but the default 16px corner radius on its
        // ~250px square bounding box (rings included) draws a boxy cutout
        // that leaves visible dimmed corners around the circle. Elements
        // opting in via data-tour-shape="circle" get a per-step stage radius
        // large enough to render the cutout as a true circle instead; every
        // other step falls back to the shared card-shaped default.
        if (element.dataset['tourShape'] === 'circle') {
          const rect = element.getBoundingClientRect();
          const diameter = Math.min(rect.width, rect.height);
          driverObj.setConfig({ ...driverObj.getConfig(), stagePadding: 4, stageRadius: diameter / 2 + 4 });
        } else {
          driverObj.setConfig({ ...driverObj.getConfig(), stagePadding: 8, stageRadius: 16 });
        }
        const onRealClick = (): void => {
          claimedByRealClick = true;
          driverObj.destroy();
        };
        // capture:true is load-bearing: Angular's own (click)/routerLink handlers on this same
        // element are registered in bubble phase, so a bubble-phase listener here would race a
        // router navigation's NavigationStart against claimedByRealClick — capture guarantees
        // this runs, and the flag is set, before Angular's own handling even starts.
        element.addEventListener('click', onRealClick, { capture: true, once: true });
        cleanup = () => element.removeEventListener('click', onRealClick, { capture: true });
      },
      onDeselected: () => {
        cleanup?.();
        cleanup = null;
      },
      onDestroyed: () => {
        cleanup?.();
        window.speechSynthesis?.cancel();
        this.activeRun = null;
        if (!bailedOut) void this.auth.markTourSeen(tour);
      },
    });

    this.activeRun = {
      driverObj,
      forceBailout: () => {
        if (driverObj.isActive() && !claimedByRealClick) {
          bailedOut = true;
          driverObj.destroy();
        }
      },
    };
    driverObj.drive();
  }

  // --- step builders -------------------------------------------------

  private orientationSteps(): DriveStep[] {
    return [
      {
        popover: {
          title: 'Say it. VoxFit logs it.',
          description:
            "No forms, no typing. Talk through your workout or meal like you're telling a friend, and VoxFit turns it into structured data. 60 seconds, then you're set.",
        },
      },
      {
        element: '[data-tour="voice-orb"]',
        popover: {
          title: 'This is the whole app',
          description:
            'Tap it anytime to log a workout by voice. Your streak, your macros, your history — all of it starts with what you say here.',
        },
      },
      {
        element: '[data-tour="streak-pill"]',
        popover: {
          title: 'Consistency, tracked automatically',
          description:
            "Every day you log something, this grows. Miss a day and it resets — so it's honest, not decorative.",
        },
      },
      {
        element: '[data-tour="fuel-card"]',
        popover: {
          title: 'Your macros, without the math',
          description:
            'Calories, protein, carbs, fat — filled in the moment you log a meal. Nothing to calculate yourself.',
        },
      },
      {
        element: '[data-tour="quick-actions"]',
        popover: {
          title: "Everything's one tap away",
          description:
            'Log a workout, log a meal, check your plan, or see your progress — never hunt for the right button.',
        },
      },
      {
        element: '[data-tour="nav-train"]',
        popover: {
          title: 'Train — your full history',
          description: "Every session you've logged, your weekly volume, and filters to find any workout again.",
        },
      },
      {
        element: '[data-tour="nav-fuel"]',
        popover: {
          title: 'Fuel — meals, the same way',
          description: "Two ways to log food, both by talking. We'll show you exactly how in a second.",
        },
      },
      {
        element: '[data-tour="nav-you"]',
        popover: {
          title: 'You — the receipts',
          description:
            'Badges, streak history, a 6-month activity heatmap. This is where consistency starts to feel like proof.',
        },
      },
      {
        popover: {
          title: 'Try it for real?',
          description: "Let's log something. Tap the mic and we'll walk through exactly what to say.",
          nextBtnText: 'Show me',
          onNextClick: (_element, _step, opts) => {
            // Navigate to /voice rather than starting Tour B in place — its
            // first step's [data-tour="voice-orb"] selector also matches
            // Home's own orb link, so starting it here would spotlight the
            // wrong page's button. `tour_workout_seen` is still false at
            // this point, so voice-log.page.ts's own ionViewDidEnter picks
            // it up naturally once the real page has loaded.
            opts.driver.destroy();
            void this.router.navigateByUrl('/voice');
          },
        },
      },
    ];
  }

  private workoutSteps(): DriveStep[] {
    return [
      {
        element: '[data-tour="voice-orb"]',
        popover: {
          title: 'Hold or tap — either works',
          description:
            "Tap once to start, tap again when you're done. VoxFit listens the whole time, so there's no need to rush.",
        },
      },
      {
        element: '[data-tour="voice-orb"]',
        popover: {
          title: "Talk like you're telling a friend",
          description: this.sayContentHtml('workout'),
          onPopoverRender: (popover) => this.wireHearExample(popover, WORKOUT_EXAMPLE),
        },
      },
      {
        element: '[data-tour="structure-it-btn"]',
        popover: {
          title: 'You always get the final word',
          description:
            "Tap Structure it, and VoxFit turns your words into sets and reps. Review every number before it saves — edit anything that's off.",
        },
      },
      {
        popover: {
          title: "That's genuinely it",
          description: "Next time, just tap the mic and talk. No tour, no reminders — you'll have it in one try.",
          doneBtnText: 'Got it',
        },
      },
    ];
  }

  private journalSteps(): DriveStep[] {
    return [
      {
        element: '[data-tour="journal-plan-banner"]',
        popover: {
          title: 'A plan, built from your training',
          description:
            'VoxFit reads your recent sessions and builds a split around them — tap in to see it or generate a fresh one.',
        },
      },
      {
        element: '[data-tour="journal-volume-chart"]',
        popover: {
          title: 'Your training, charted',
          description:
            "Tonnage lifted this week, day by day. Tap a bar to see that day's number instead of the weekly total.",
        },
      },
      {
        element: '[data-tour="journal-filters"]',
        popover: {
          title: 'Slice it any way',
          description: 'This week, everything, PRs only, a specific month or date range — the list below follows.',
        },
      },
      {
        element: '[data-tour="journal-session-list"]',
        popover: {
          title: 'Every session, one tap away',
          description: "Tap any row to open the full breakdown — sets, reps, weight, and what you said to log it.",
        },
      },
    ];
  }

  private profileSteps(): DriveStep[] {
    return [
      {
        element: '[data-tour="profile-identity"]',
        popover: {
          title: 'This is you',
          description: 'Your goal and training style. Tap the gear top-right anytime to change your details.',
        },
      },
      {
        element: '[data-tour="profile-checkin"]',
        popover: {
          title: 'Your coach checks in',
          description: 'A short read on how your training and nutrition are trending, generated from your real data.',
        },
      },
      {
        element: '[data-tour="profile-badges"]',
        popover: {
          title: 'Earned, not decorative',
          description: 'Badges unlock automatically from streaks, PRs and consistency — nothing to claim or configure.',
        },
      },
      {
        element: '[data-tour="profile-preferences"]',
        popover: {
          title: 'Your targets, at a glance',
          description: 'Calories, macros, BMI and goal — all editable in Settings whenever your plan changes.',
        },
      },
    ];
  }

  private mealSteps(): DriveStep[] {
    return [
      {
        element: '[data-tour="meal-mode-cards"]',
        popover: {
          title: 'Two ways to log food',
          description:
            'Cooking something? Use "What can I make?". Already ate? Use "I already ate this." Both are just talking.',
        },
      },
      {
        element: '[data-tour="meal-mode-make"]',
        popover: {
          title: "Tell it what you've got",
          description: this.sayContentHtml('makeMeal'),
          onPopoverRender: (popover) => this.wireHearExample(popover, MAKE_MEAL_EXAMPLE),
        },
      },
      {
        element: '[data-tour="meal-mode-ate"]',
        popover: {
          title: 'Just describe the plate',
          description: this.sayContentHtml('ateMeal'),
          onPopoverRender: (popover) => this.wireHearExample(popover, ATE_MEAL_EXAMPLE),
        },
      },
      {
        element: '[data-tour="macro-card"]',
        popover: {
          title: 'Macros, filled in automatically',
          description:
            'Whichever way you log, your calories and macros update immediately — no searching a food database.',
        },
      },
    ];
  }

  // --- rich content + speech wiring -----------------------------------

  private sayContentHtml(kind: SayContentKind): string {
    const content = SAY_CONTENT[kind];
    const cats = content.categories
      .map(
        (c) =>
          `<div class="tour-say-cat"><div class="ic">${c.icon}</div><div class="tx"><b>${c.label}</b> <span>— "${c.hint}"</span></div></div>`,
      )
      .join('');
    const words = content.example
      .split(' ')
      .map((w, i) => `<span class="tour-word" data-i="${i}">${w}</span>`)
      .join(' ');
    return `
      <p>${content.lead}</p>
      <div class="tour-say-cats">${cats}</div>
      <div class="tour-say-example" id="tour-example-${kind}">"${words}"</div>
      <button class="tour-hear-btn" id="tour-hear-${kind}" type="button">
        <span class="play-dot">▶</span>
        <span class="hear-label">Hear an example</span>
      </button>
    `;
  }

  private wireHearExample(popover: { description: HTMLElement }, exampleText: string): void {
    const btn = popover.description.querySelector<HTMLButtonElement>('.tour-hear-btn');
    const exampleEl = popover.description.querySelector<HTMLElement>('.tour-say-example');
    if (!btn || !exampleEl) return;

    if (!this.speech.isSupported()) {
      btn.style.display = 'none';
      return;
    }

    let stop: (() => void) | null = null;

    btn.addEventListener('click', () => {
      if (stop) {
        stop();
        stop = null;
        this.resetLabel(btn, exampleEl);
        return;
      }
      const label = btn.querySelector('.hear-label');
      if (label) label.textContent = 'Playing…';
      const wordEls = Array.from(exampleEl.querySelectorAll<HTMLElement>('.tour-word'));

      stop = this.speech.speak(
        exampleText,
        (charIndex) => {
          const idx = findSpokenWordIndex(exampleText, charIndex);
          wordEls.forEach((el, i) => el.classList.toggle('said', i <= idx));
        },
        () => {
          stop = null;
          this.resetLabel(btn, exampleEl);
        },
      );
    });
  }

  private resetLabel(btn: HTMLButtonElement, exampleEl: HTMLElement): void {
    const label = btn.querySelector('.hear-label');
    if (label) label.textContent = 'Hear an example';
    exampleEl.querySelectorAll('.tour-word').forEach((el) => el.classList.remove('said'));
  }
}
