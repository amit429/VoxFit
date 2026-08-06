import { Component, input, output } from '@angular/core';
import { addIcons } from 'ionicons';
import { checkmarkOutline } from 'ionicons/icons';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import type { ProgressReviewRow } from '@/app/models';

addIcons({ checkmarkOutline });

/**
 * Presentational card that renders a `ProgressReviewRow` — the AI's weekly
 * progress note — in the app's calm "Coach Note" register. Even an
 * `attention` headline tone stays free of red/danger styling and clinical
 * iconography; hierarchy comes from the surface ladder, not color.
 */
@Component({
  selector: 'vox-progress-review-card',
  standalone: true,
  imports: [VoxIconComponent, VoxCardComponent, VoxBadgeComponent],
  templateUrl: './progress-review-card.component.html',
  styleUrl: './progress-review-card.component.scss',
})
export class ProgressReviewCardComponent {
  readonly review = input.required<ProgressReviewRow>();
  readonly acknowledge = output<string>();
}
