import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ExerciseTypeDb, VoiceSetRowMock } from '@/app/models';

@Component({
  selector: 'app-exercise-sets-preview-table',
  standalone: true,
  templateUrl: './exercise-sets-preview-table.component.html',
  styleUrl: './exercise-sets-preview-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseSetsPreviewTableComponent {
  readonly exerciseType = input.required<ExerciseTypeDb>();
  readonly setRows = input.required<readonly VoiceSetRowMock[]>();
  /** 1-based row index from extract; null = no highlight. */
  readonly highlightRowIndex = input<number | null>(null);

  readonly rowClick = output<number>();

  protected onRowClick(rowIndex: number): void {
    this.rowClick.emit(rowIndex);
  }
}
