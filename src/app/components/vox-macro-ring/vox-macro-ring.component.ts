import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type VoxMacroRingTone = 'jade' | 'slate' | 'apricot' | 'brand' | 'rose';

const RADIUS = 29;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TONE_STROKE: Record<VoxMacroRingTone, string> = {
  jade: 'var(--vox-jade)',
  slate: 'var(--vox-slate)',
  apricot: 'var(--vox-apricot)',
  brand: 'var(--vox-brand)',
  rose: 'var(--vox-rose)',
};

/**
 * SVG ring gauge for a single macro. Colour is by data series, not by status:
 * protein is jade, carbs slate, fat apricot — consistently, whether the user
 * is over or under target.
 */
@Component({
  selector: 'vox-macro-ring',
  standalone: true,
  templateUrl: './vox-macro-ring.component.html',
  styleUrl: './vox-macro-ring.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxMacroRingComponent {
  readonly value = input.required<number>();
  readonly target = input.required<number>();
  readonly label = input.required<string>();
  readonly tone = input<VoxMacroRingTone>('jade');
  /** Unit suffix shown beside the figures, e.g. `g`. Omit for calories. */
  readonly unit = input('');

  protected readonly circumference = CIRCUMFERENCE;

  /** Clamped so an over-target macro fills the ring rather than wrapping it. */
  protected readonly pct = computed(() => {
    const t = this.target();
    if (t <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((this.value() / t) * 100)));
  });

  protected readonly dashOffset = computed(() => CIRCUMFERENCE * (1 - this.pct() / 100));

  protected readonly stroke = computed(() => TONE_STROKE[this.tone()]);
}
