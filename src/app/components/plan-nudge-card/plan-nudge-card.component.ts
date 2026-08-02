import { Component, input, output } from '@angular/core';
import { addIcons } from 'ionicons';
import { checkmarkOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import type { PlanNudgeRow } from '@/app/models';

addIcons({ checkmarkOutline });

/**
 * Presentational card that renders a `PlanNudgeRow` — the AI's weekly
 * execution coaching against the user's active plan — in the app's calm
 * register. Adherence and drift are reported plainly, with no red/danger
 * styling or clinical iconography even when the plan suggests a refresh.
 */
@Component({
  selector: 'vox-plan-nudge-card',
  standalone: true,
  imports: [VoxIconComponent],
  templateUrl: './plan-nudge-card.component.html',
  styleUrl: './plan-nudge-card.component.scss',
})
export class PlanNudgeCardComponent {
  readonly nudge = input.required<PlanNudgeRow>();
  readonly acknowledge = output<string>();
  readonly refresh = output<void>();
}
