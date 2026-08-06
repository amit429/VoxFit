import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * −/value/+ row for a numeric target (Settings macro targets).
 *
 * Emits the clamped next value rather than a delta, so callers never have to
 * re-apply bounds at the call site.
 */
@Component({
  selector: 'vox-stepper-row',
  standalone: true,
  templateUrl: './vox-stepper-row.component.html',
  styleUrl: './vox-stepper-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxStepperRowComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly emoji = input('');
  /** Background tint behind the emoji, e.g. `rgba(232,160,85,.15)`. */
  readonly iconTint = input('rgba(255,255,255,.07)');
  readonly unit = input('');
  readonly step = input(10);
  readonly min = input(0);
  readonly max = input(10000);

  readonly valueChange = output<number>();

  protected readonly atMin = computed(() => this.value() <= this.min());
  protected readonly atMax = computed(() => this.value() >= this.max());

  protected bump(direction: -1 | 1): void {
    const next = this.value() + direction * this.step();
    const clamped = Math.max(this.min(), Math.min(this.max(), next));
    if (clamped !== this.value()) this.valueChange.emit(clamped);
  }
}
