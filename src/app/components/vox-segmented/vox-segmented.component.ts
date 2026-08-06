import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { VoxSegment } from '@/app/models';

/**
 * Segmented control (Day / Week / Month). The selected segment fills jade —
 * the affirmative accent — with `--vox-on-jade` ink, since white on jade
 * fails contrast badly.
 */
@Component({
  selector: 'vox-segmented',
  standalone: true,
  templateUrl: './vox-segmented.component.html',
  styleUrl: './vox-segmented.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxSegmentedComponent<T extends string = string> {
  readonly segments = input.required<readonly VoxSegment<T>[]>();
  readonly value = input.required<T>();

  readonly valueChange = output<T>();
}
