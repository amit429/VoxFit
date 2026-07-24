import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronUpOutline, createOutline, sparklesOutline, trophyOutline } from 'ionicons/icons';
import type { WorkoutExerciseExtract } from '@/app/models';
import { ExerciseSetsPreviewTableComponent } from '@/app/components/exercise-sets-preview-table/exercise-sets-preview-table.component';
import { ExerciseEditorModalComponent } from '@/app/components/exercise-editor-modal/exercise-editor-modal.component';
import { workoutExercisesToVoiceMocks } from '@/app/utils/workout-extract-ui.mapper';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

addIcons({ createOutline, chevronDownOutline, chevronUpOutline, sparklesOutline, trophyOutline });

@Component({
  selector: 'app-session-exercise-review-card',
  standalone: true,
  imports: [
    ExerciseSetsPreviewTableComponent,
    ExerciseEditorModalComponent,
    VoxCardComponent,
    VoxBadgeComponent,
    VoxIconComponent,
  ],
  templateUrl: './session-exercise-review-card.component.html',
  styleUrl: './session-exercise-review-card.component.scss',
})
export class SessionExerciseReviewCardComponent {
  readonly sessionTitle = input('');
  readonly coachSummary = input<string | null>(null);
  readonly exercises = input.required<readonly WorkoutExerciseExtract[]>();
  /** When this changes (e.g. journal session id), accordion expansion resets. */
  readonly sessionContextId = input<string | undefined>(undefined);

  readonly exercisesChange = output<WorkoutExerciseExtract[]>();

  protected readonly voiceExerciseRows = computed(() => workoutExercisesToVoiceMocks([...this.exercises()]));

  protected readonly expandedExerciseKeys = signal<ReadonlySet<number>>(new Set());
  protected readonly editorOpen = signal(false);
  protected readonly editingExerciseIndex = signal<number | null>(null);
  protected readonly editorFocusSetRowIndex = signal<number | null>(null);

  constructor() {
    effect(() => {
      void this.sessionContextId();
      untracked(() => this.expandedExerciseKeys.set(new Set()));
    });
  }

  protected editingExercise(): WorkoutExerciseExtract | null {
    const list = this.exercises();
    const i = this.editingExerciseIndex();
    if (i == null || i < 0 || i >= list.length) {
      return null;
    }
    return list[i] ?? null;
  }

  protected highlightRowForExercise(exerciseIndex: number): number | null {
    if (!this.editorOpen() || this.editingExerciseIndex() !== exerciseIndex) {
      return null;
    }
    return this.editorFocusSetRowIndex();
  }

  protected openExerciseEditor(exerciseIndex: number, setRowIndex?: number, ev?: Event): void {
    ev?.stopPropagation();
    this.editingExerciseIndex.set(exerciseIndex);
    this.editorFocusSetRowIndex.set(setRowIndex ?? null);
    this.editorOpen.set(true);
  }

  protected onEditorDismissed(): void {
    this.editorOpen.set(false);
    this.editingExerciseIndex.set(null);
    this.editorFocusSetRowIndex.set(null);
  }

  protected onEditorSaved(ex: WorkoutExerciseExtract): void {
    const list = [...this.exercises()];
    const idx = this.editingExerciseIndex();
    if (idx == null || idx < 0 || idx >= list.length) {
      this.onEditorDismissed();
      return;
    }
    const next = list.map((e, i) => (i === idx ? ex : e));
    this.exercisesChange.emit(next);
    this.onEditorDismissed();
  }

  protected toggleExercise(index: number): void {
    const next = new Set(this.expandedExerciseKeys());
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.expandedExerciseKeys.set(next);
  }

  protected isExerciseExpanded(index: number): boolean {
    return this.expandedExerciseKeys().has(index);
  }
}
