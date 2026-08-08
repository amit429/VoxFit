import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { MuscleGroupKey, MuscleShareRow } from '@/app/models';

const MUSCLE_LABELS: Record<MuscleGroupKey, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  glutes: 'Glutes',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  cardio: 'Cardio',
  other: 'Other',
};

/**
 * A stable colour per muscle group, drawn from the accent palette.
 *
 * This is the one place in the system where colour identifies a *series* rather
 * than carrying a role — the same job it does in the macro rings. A group must
 * keep its colour between visits, or the chart can't be read at a glance.
 */
const MUSCLE_GRADIENTS: Record<MuscleGroupKey, string> = {
  legs: 'linear-gradient(90deg, var(--vox-jade-bright), var(--vox-jade-deep))',
  chest: 'linear-gradient(90deg, var(--vox-brand), var(--vox-brand-deep))',
  back: 'linear-gradient(90deg, var(--vox-slate), var(--vox-slate-deep))',
  shoulders: 'linear-gradient(90deg, var(--vox-apricot-bright), #ef8f3f)',
  arms: 'linear-gradient(90deg, var(--vox-rose), #c25a54)',
  glutes: 'linear-gradient(90deg, var(--vox-jade), var(--vox-jade-deep))',
  core: 'linear-gradient(90deg, var(--vox-brand-bright), var(--vox-brand))',
  cardio: 'linear-gradient(90deg, var(--vox-slate), var(--vox-slate-deep))',
  other: 'linear-gradient(90deg, rgba(255,255,255,.3), rgba(255,255,255,.18))',
};

interface SplitRow {
  readonly key: MuscleGroupKey;
  readonly label: string;
  readonly sharePct: number;
  readonly gradient: string;
}

/**
 * All-time volume share per muscle group.
 *
 * Ordered by share, largest first — unlike the muscle map's chips, this chart's
 * whole point is the ranking, so sorting by value is what makes it readable.
 * Cardio is excluded upstream: it carries no tonnage, so including it would
 * make every strength share read artificially low.
 */
@Component({
  selector: 'vox-muscle-split',
  standalone: true,
  templateUrl: './vox-muscle-split.component.html',
  styleUrl: './vox-muscle-split.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxMuscleSplitComponent {
  readonly overall = input.required<readonly MuscleShareRow[]>();

  protected readonly rows = computed((): SplitRow[] =>
    this.overall()
      .filter((r) => r.sharePct > 0)
      .map((r) => ({
        key: r.muscle,
        label: MUSCLE_LABELS[r.muscle],
        sharePct: r.sharePct,
        gradient: MUSCLE_GRADIENTS[r.muscle],
      })),
  );

  protected readonly hasData = computed(() => this.rows().length > 0);

  /**
   * Groups that were trained but contributed no tonnage — bodyweight work like
   * pull-ups and crunches.
   *
   * Called out rather than silently dropped. A user who trained back twice and
   * then sees "Chest 100%" would reasonably conclude the chart is broken; naming
   * the reason is the difference between a limitation and a bug.
   */
  protected readonly bodyweightOnly = computed(() =>
    this.overall()
      .filter((r) => r.sharePct === 0 && r.volumeKg === 0)
      .map((r) => MUSCLE_LABELS[r.muscle]),
  );

  protected readonly bodyweightNote = computed(() => {
    const groups = this.bodyweightOnly();
    if (groups.length === 0) return '';
    const list =
      groups.length === 1 ? groups[0]
      : `${groups.slice(0, -1).join(', ')} and ${groups[groups.length - 1]}`;
    return `${list} came from bodyweight work, which carries no tonnage to chart.`;
  });
}
