import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
} from '@ionic/angular/standalone';

export type VoxPageHeaderVariant = 'app' | 'auth' | 'auth-step';
export type VoxPageHeaderSize = 'normal' | 'large';

@Component({
  selector: 'vox-page-header',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, NgClass],
  templateUrl: './vox-page-header.component.html',
  styleUrls: ['./vox-page-header.component.scss'],
})
export class VoxPageHeaderComponent {
  readonly variant = input<VoxPageHeaderVariant>('app');
  /** Center title (app variant). Ignored if empty and `header-title` content is projected. */
  readonly title = input<string>('');
  readonly translucent = input(true);
  /** Auto-insert back button instead of using `header-start` projection */
  readonly showBackButton = input<boolean>(false);
  /** URL for back button navigation */
  readonly backHref = input<string>('');
  /** Back button aria label */
  readonly backLabel = input('Go back');
  /** Header size: 'normal' (52px) or 'large' (68px+) */
  readonly size = input<VoxPageHeaderSize>('large');
}
