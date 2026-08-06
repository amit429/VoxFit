import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonModal } from '@ionic/angular/standalone';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { ProgressReviewCardComponent } from '@/app/components/progress-review-card/progress-review-card.component';
import type { ProgressReviewRow } from '@/app/models';

/**
 * The full AI check-in, as a centred dialog.
 *
 * Profile shows only the compact nudge; the review body is long enough that
 * inlining it pushed everything else off the screen. A centred modal rather
 * than a bottom sheet: this is content to read, not a control to operate.
 */
@Component({
  selector: 'vox-checkin-modal',
  standalone: true,
  imports: [IonModal, VoxIconComponent, ProgressReviewCardComponent],
  templateUrl: './vox-checkin-modal.component.html',
  styleUrl: './vox-checkin-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxCheckinModalComponent {
  readonly isOpen = input(false);
  readonly review = input<ProgressReviewRow | null>(null);

  readonly dismissed = output<void>();
  readonly acknowledge = output<string>();
}
