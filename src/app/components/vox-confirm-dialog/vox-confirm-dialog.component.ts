import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonModal } from '@ionic/angular/standalone';

/**
 * Centred yes/no dialog for an action that cannot be undone.
 *
 * Ionic's `alertController` would be fewer lines, but it paints its own
 * Material/iOS chrome and lands on the screen looking borrowed. This is the
 * same `.vox-centre-modal` shell the recipe dialog uses, so a destructive
 * confirmation reads as part of the app rather than as the platform
 * interrupting it.
 *
 * The confirm button is rose because rose is the destructive role in this
 * palette — not because anything has gone wrong.
 */
@Component({
  selector: 'vox-confirm-dialog',
  standalone: true,
  imports: [IonModal],
  templateUrl: './vox-confirm-dialog.component.html',
  styleUrl: './vox-confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxConfirmDialogComponent {
  readonly open = input(false);
  readonly heading = input.required<string>();
  readonly body = input('');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');

  readonly confirmed = output<void>();
  readonly dismissed = output<void>();
}
