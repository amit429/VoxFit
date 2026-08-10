import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { addIcons } from 'ionicons';
import { sparkles } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

addIcons({ sparkles });

/**
 * The "why this plan" card — collapsed to two lines by default.
 *
 * The prompt asks for a short rationale under 180 characters and the model
 * usually obliges, but the clamp is not conditional on that: a long string must
 * never be able to push the plan itself below the fold again, which is the
 * failure this card exists to fix.
 */
@Component({
  selector: 'vox-plan-rationale',
  standalone: true,
  imports: [VoxIconComponent],
  templateUrl: './vox-plan-rationale.component.html',
  styleUrl: './vox-plan-rationale.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxPlanRationaleComponent {
  readonly short = input.required<string>();
  readonly full = input<string>('');

  protected readonly expanded = signal(false);

  /** No "Read more" when the long form adds nothing beyond the short one. */
  protected readonly canExpand = computed(() => {
    const full = this.full().trim();
    return full.length > 0 && full !== this.short().trim();
  });

  protected readonly text = computed(() =>
    this.expanded() && this.canExpand() ? this.full() : this.short(),
  );

  protected toggle(): void {
    this.expanded.update((v) => !v);
  }
}
