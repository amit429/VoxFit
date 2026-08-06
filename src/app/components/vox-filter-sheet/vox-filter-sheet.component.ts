import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IonModal } from '@ionic/angular/standalone';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import type { MoodDb, VoxSessionFilters } from '@/app/models';

export const EMPTY_SESSION_FILTERS: VoxSessionFilters = {
  moods: [],
  prsOnly: false,
  notesOnly: false,
};

const MOOD_OPTIONS: readonly { id: MoodDb; label: string }[] = [
  { id: 'positive', label: '😊 Positive' },
  { id: 'neutral', label: '😐 Neutral' },
  { id: 'negative', label: '😔 Low' },
];

/**
 * Session filter sheet.
 *
 * Scope is deliberately narrower than the mockup: session-type and
 * min-volume filters are absent because neither can be answered from the
 * journal's lean paginated query — `workout_sessions` has no session-type
 * column, and volume lives in `set_lines`, which that query omits on purpose
 * for cost. See Deferred #7 in REVAMP-PROGRESS.md.
 *
 * Edits are staged locally and only emitted on apply, so dismissing the sheet
 * leaves the caller's filters untouched.
 */
@Component({
  selector: 'vox-filter-sheet',
  standalone: true,
  imports: [IonModal, VoxBadgeComponent],
  templateUrl: './vox-filter-sheet.component.html',
  styleUrl: './vox-filter-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxFilterSheetComponent {
  readonly isOpen = input(false);
  readonly filters = input<VoxSessionFilters>(EMPTY_SESSION_FILTERS);
  /** Live count of what the staged filters would show, for the CTA label. */
  readonly resultCount = input<number | null>(null);

  readonly apply = output<VoxSessionFilters>();
  readonly dismissed = output<void>();
  /**
   * Fires on every staged edit so the host can preview the result count.
   * Distinct from `apply`: staging must not change what the list shows until
   * the user confirms.
   */
  readonly stagedChange = output<VoxSessionFilters>();

  protected readonly moodOptions = MOOD_OPTIONS;

  private readonly staged = signal<VoxSessionFilters | null>(null);

  /** Staged edits if the user has touched anything, else the input as-is. */
  protected readonly current = computed(() => this.staged() ?? this.filters());

  protected readonly ctaLabel = computed(() => {
    const n = this.resultCount();
    if (n === null) return 'Show sessions';
    return n === 1 ? 'Show 1 session' : `Show ${n} sessions`;
  });

  protected readonly isDirty = computed(() => {
    const c = this.current();
    return c.moods.length > 0 || c.prsOnly || c.notesOnly;
  });

  protected isMoodOn(mood: MoodDb): boolean {
    return this.current().moods.includes(mood);
  }

  protected toggleMood(mood: MoodDb): void {
    const c = this.current();
    const moods = c.moods.includes(mood) ? c.moods.filter((m) => m !== mood) : [...c.moods, mood];
    this.stage({ ...c, moods });
  }

  protected togglePrs(): void {
    const c = this.current();
    this.stage({ ...c, prsOnly: !c.prsOnly });
  }

  protected toggleNotes(): void {
    const c = this.current();
    this.stage({ ...c, notesOnly: !c.notesOnly });
  }

  protected reset(): void {
    this.stage(EMPTY_SESSION_FILTERS);
  }

  private stage(next: VoxSessionFilters): void {
    this.staged.set(next);
    this.stagedChange.emit(next);
  }

  protected onApply(): void {
    this.apply.emit(this.current());
    this.staged.set(null);
  }

  protected onDismiss(): void {
    /* Discard staged edits and tell the host to re-sync its preview count. */
    this.staged.set(null);
    this.stagedChange.emit(this.filters());
    this.dismissed.emit();
  }
}
