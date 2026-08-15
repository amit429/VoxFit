import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IonModal } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDownOutline, checkmarkOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

addIcons({ chevronDownOutline, checkmarkOutline });

/**
 * Picks which exercise a chart is about.
 *
 * A bottom sheet rather than `ion-select`: Ionic's select paints its own
 * platform chrome (an iOS-style action sheet or a Material alert depending on
 * the mode), which lands looking borrowed in this system. Same reasoning as
 * `vox-confirm-dialog` preferring its own shell over `alertController`.
 *
 * Open state is owned here rather than by the host — the host has no decision
 * to make about it, and threading `isOpen` through every caller would be
 * ceremony. Only the resulting choice is emitted.
 */
@Component({
  selector: 'vox-exercise-picker',
  standalone: true,
  imports: [IonModal, VoxIconComponent],
  templateUrl: './vox-exercise-picker.component.html',
  styleUrl: './vox-exercise-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxExercisePickerComponent {
  readonly exercises = input.required<readonly string[]>();
  readonly selected = input<string | null>(null);
  /** Label above the sheet's list, so the sheet says what it is picking for. */
  readonly heading = input('Choose exercise');

  readonly selectionChange = output<string>();

  protected readonly isOpen = signal(false);

  /**
   * With one exercise there is nothing to choose, so the trigger renders as
   * plain text — an affordance that opens a single-item list is a small lie.
   */
  protected readonly canPick = computed(() => this.exercises().length > 1);

  protected readonly label = computed(() => this.selected() ?? this.exercises()[0] ?? '');

  protected open(): void {
    if (!this.canPick()) return;
    this.isOpen.set(true);
  }

  protected close(): void {
    this.isOpen.set(false);
  }

  protected choose(name: string): void {
    this.isOpen.set(false);
    /* Re-picking the current exercise is a no-op, not a redundant refetch. */
    if (name === this.selected()) return;
    this.selectionChange.emit(name);
  }
}
