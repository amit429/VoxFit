import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { addIcons } from 'ionicons';
import { checkmark, sparkles } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import type { WorkoutPlanFocus } from '@/app/models';

addIcons({ checkmark, sparkles });

type StepState = 'done' | 'active' | 'pending';

interface BuildStep {
  readonly label: string;
  readonly state: StepState;
}

interface GhostCard {
  readonly index: number;
  readonly focus: WorkoutPlanFocus;
  readonly delay: string;
}

/**
 * What each step says maps to what the agent is actually doing — it calls
 * `get_training_stats`, then `get_recurring_notes`, then writes the split. The
 * timings are estimates, but the sequence is not invented, so a user who reads
 * it learns something true about how their plan gets made.
 */
const STEPS: readonly { readonly label: string; readonly at: number }[] = [
  { label: 'Reading your recent sessions', at: 0 },
  { label: 'Finding your strongest lifts', at: 2.8 },
  { label: 'Balancing push, pull and legs', at: 5.8 },
  { label: 'Setting your starting loads', at: 9 },
  { label: 'Writing your coaching notes', at: 12 },
];

/** Rotating line under the headline — the part that is allowed to have a personality. */
const ASIDES: readonly string[] = [
  'Reading between your rep counts.',
  'Balancing the hard days against the easy ones.',
  'Yes, leg day made the cut.',
  'Picking loads you can actually start at.',
  'Every week should look a little different.',
];

const EXPECTED_SECONDS = 15;
const ASIDE_ROTATE_SECONDS = 3.6;
const TICK_MS = 120;
/** The bar approaches this but never arrives: the call is done when it is done. */
const PROGRESS_CEILING = 94;
const GHOST_FOCUS_CYCLE: readonly WorkoutPlanFocus[] = ['push', 'legs', 'pull', 'full', 'cardio', 'recovery'];

/**
 * The generating state.
 *
 * A 15-second AI call behind a bare spinner reads as a hang, and users cancel
 * hangs. So this screen does three things a spinner cannot: it names the work
 * in progress, it shows a bar that visibly advances, and it assembles ghost day
 * cards in the shape of the plan being built — by the time the real plan lands
 * the user already knows what is arriving.
 *
 * The progress figure is honest about being an estimate: it eases towards a
 * ceiling it never reaches rather than claiming a percentage it cannot know,
 * and if the call runs long the copy admits that instead of sitting at 99%.
 */
@Component({
  selector: 'vox-plan-building',
  standalone: true,
  imports: [NgClass, VoxIconComponent],
  templateUrl: './vox-plan-building.component.html',
  styleUrl: './vox-plan-building.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxPlanBuildingComponent {
  readonly daysPerWeek = input.required<number>();
  /** `regenerate` when a plan already exists — the headline says so. */
  readonly rebuilding = input(false);

  private readonly elapsed = signal(0);

  constructor() {
    const started = Date.now();
    const timer = setInterval(() => this.elapsed.set((Date.now() - started) / 1000), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected readonly title = computed(
    () => `${this.rebuilding() ? 'Rebuilding' : 'Building'} your ${this.daysPerWeek()}-day plan`,
  );

  protected readonly aside = computed(
    () => ASIDES[Math.floor(this.elapsed() / ASIDE_ROTATE_SECONDS) % ASIDES.length],
  );

  protected readonly steps = computed<BuildStep[]>(() => {
    const seconds = this.elapsed();
    // The final step never ticks over to done — the work is not finished until
    // the plan arrives, and this component is unmounted the moment it does.
    const activeIndex = STEPS.reduce((last, step, i) => (seconds >= step.at ? i : last), 0);
    return STEPS.map((step, i) => ({
      label: step.label,
      state: i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending',
    }));
  });

  protected readonly activeLabel = computed(
    () => this.steps().find((s) => s.state === 'active')?.label ?? '',
  );

  /** Eases towards `PROGRESS_CEILING` asymptotically — fast early, never at 100. */
  protected readonly progress = computed(() =>
    Math.round(PROGRESS_CEILING * (1 - Math.exp(-this.elapsed() / 5.5))),
  );

  /** False once the estimate has run out and the line becomes prose, not a figure. */
  protected readonly counting = computed(() => EXPECTED_SECONDS - this.elapsed() > 1);

  protected readonly eta = computed(() => {
    const remaining = EXPECTED_SECONDS - this.elapsed();
    if (remaining > 1) return `~${Math.ceil(remaining)}s left`;
    return 'Almost there — the coach is being thorough';
  });

  protected readonly ghosts = computed<GhostCard[]>(() =>
    Array.from({ length: this.daysPerWeek() }, (_, i) => ({
      index: i + 1,
      focus: GHOST_FOCUS_CYCLE[i % GHOST_FOCUS_CYCLE.length],
      // Spread the arrivals across the expected wait so a card lands roughly
      // whenever the user's attention drifts back to the bottom of the screen.
      delay: `${(i * EXPECTED_SECONDS) / Math.max(this.daysPerWeek(), 1) / 2}s`,
    })),
  );
}
