import {
  Component,
  ChangeDetectorRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonModal,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonInput,
  IonItem,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonContent,
  IonFooter,
  IonIcon,
  IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline, trashOutline } from 'ionicons/icons';
import type { ExerciseEditorFormModel, ExerciseSetLineDraft, ExerciseTypeDb, PrSource, WorkoutExerciseExtract } from '@/app/models';
import { emptySetLineDraft, exerciseToFormModel, formModelToExercise } from '@/app/utils/workout-exercise-draft.util';

addIcons({ addOutline, closeOutline, trashOutline });

@Component({
  selector: 'app-exercise-editor-modal',
  standalone: true,
  imports: [
    FormsModule,
    IonModal,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonContent,
    IonFooter,
    IonInput,
    IonItem,
    IonToggle,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonText,
  ],
  templateUrl: './exercise-editor-modal.component.html',
  styleUrl: './exercise-editor-modal.component.scss',
})
export class ExerciseEditorModalComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isOpen = input(false);
  readonly exercise = input<WorkoutExerciseExtract | null>(null);
  /** 1-based row index matching preview table; scrolls into view in the editor. */
  readonly focusSetRowIndex = input<number | null>(null);
  /** Sheet header label — reuse this component for other flows by changing the title. */
  readonly modalTitle = input('Edit exercise');

  readonly saved = output<WorkoutExerciseExtract>();
  readonly dismissed = output<void>();

  protected draftName = '';
  protected draftExerciseType: ExerciseTypeDb = 'strength';
  protected draftIsPr = false;
  /** Not user-editable here — carried through the round trip alongside is_pr so an edit never launders it. */
  protected draftPrSource: PrSource = null;
  protected draftLines: ExerciseSetLineDraft[] = [emptySetLineDraft('strength')];
  protected saveError: string | null = null;

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const ex = this.exercise();
      const focusRow = this.focusSetRowIndex();
      if (open && ex) {
        this.hydrate(ex);
        this.saveError = null;
        if (focusRow != null && focusRow > 0) {
          const lineIdx = focusRow - 1;
          queueMicrotask(() => {
            document.getElementById(`eed-line-${lineIdx}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          });
        }
        this.cdr.markForCheck();
      }
    });
  }

  private hydrate(ex: WorkoutExerciseExtract): void {
    const m = exerciseToFormModel(ex);
    this.draftName = m.name;
    this.draftExerciseType = m.exercise_type;
    this.draftIsPr = m.is_pr;
    this.draftPrSource = m.pr_source;
    this.draftLines = m.setLines.map((l) => ({ ...l }));
    if (this.draftLines.length === 0) {
      this.draftLines = [emptySetLineDraft(this.draftExerciseType)];
    }
  }

  protected onModalDidDismiss(): void {
    this.dismissed.emit();
  }

  protected onExerciseTypeChange(ev: CustomEvent<{ value: ExerciseTypeDb }>): void {
    const value = ev.detail.value;
    const prev = this.draftExerciseType;
    if (prev === value) {
      return;
    }
    this.draftExerciseType = value;
    this.draftLines = this.draftLines.map((line) => ({
      sets: line.sets,
      weight_kg: value === 'strength' ? line.weight_kg : '',
      reps: value === 'strength' ? line.reps : '',
      duration_mins: value === 'cardio' ? line.duration_mins : '',
      distance_km: value === 'cardio' ? line.distance_km : '',
      segment_label: value === 'cardio' ? line.segment_label : '',
    }));
  }

  protected patchLine(index: number, patch: Partial<ExerciseSetLineDraft>): void {
    const asStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
    const norm: Partial<ExerciseSetLineDraft> = {};
    if (patch.sets !== undefined) {
      norm.sets = asStr(patch.sets);
    }
    if (patch.weight_kg !== undefined) {
      norm.weight_kg = asStr(patch.weight_kg);
    }
    if (patch.reps !== undefined) {
      norm.reps = asStr(patch.reps);
    }
    if (patch.duration_mins !== undefined) {
      norm.duration_mins = asStr(patch.duration_mins);
    }
    if (patch.distance_km !== undefined) {
      norm.distance_km = asStr(patch.distance_km);
    }
    if (patch.segment_label !== undefined) {
      norm.segment_label = asStr(patch.segment_label);
    }
    this.draftLines = this.draftLines.map((row, j) => (j === index ? { ...row, ...norm } : row));
  }

  protected addLine(): void {
    this.draftLines = [...this.draftLines, emptySetLineDraft(this.draftExerciseType)];
  }

  protected removeLine(index: number): void {
    if (this.draftLines.length <= 1) {
      return;
    }
    this.draftLines = this.draftLines.filter((_, j) => j !== index);
  }

  protected save(): void {
    const model: ExerciseEditorFormModel = {
      name: this.draftName,
      exercise_type: this.draftExerciseType,
      is_pr: this.draftIsPr,
      pr_source: this.draftPrSource,
      setLines: this.draftLines,
    };
    const ex = formModelToExercise(model);
    if (!ex) {
      this.saveError = 'Add an exercise name and at least one valid set row.';
      return;
    }
    this.saveError = null;
    this.saved.emit(ex);
  }
}
