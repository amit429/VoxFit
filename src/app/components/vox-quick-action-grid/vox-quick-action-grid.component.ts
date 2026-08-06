import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonRouterLinkWithHref } from '@ionic/angular/standalone';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import type { VoxQuickAction } from '@/app/models';

/**
 * The 4-up action grid on Home. Replaces the previous two full-width CTAs —
 * the orb is the primary voice affordance now, so these are secondary
 * destinations rather than competing buttons.
 */
@Component({
  selector: 'vox-quick-action-grid',
  standalone: true,
  imports: [RouterLink, IonRouterLinkWithHref, VoxIconComponent],
  templateUrl: './vox-quick-action-grid.component.html',
  styleUrl: './vox-quick-action-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxQuickActionGridComponent {
  readonly actions = input.required<readonly VoxQuickAction[]>();
}
