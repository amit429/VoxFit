import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import type { MuscleGroupKey, MuscleWeekRow } from '@/app/models';

/** Display names. The DB stores keys; labels are presentation. */
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
 * Anatomical order, so the chip row reads top-down rather than reshuffling
 * itself by volume every week — a list that reorders is hard to scan.
 */
const MUSCLE_ORDER: readonly MuscleGroupKey[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'core',
  'legs',
  'glutes',
  'cardio',
  'other',
];

interface MuscleChip {
  readonly key: MuscleGroupKey;
  readonly label: string;
  readonly hit: boolean;
}

/**
 * "This week you hit" — a front-view body with trained regions filled, plus a
 * chip per group.
 *
 * Two accents only: jade for the two highest-volume groups and brand for the
 * rest that were trained. Ranking by volume rather than colouring all of them
 * the same means the diagram answers "what did I actually focus on", not just
 * "what did I touch".
 *
 * `back` and `glutes` have no front-view region to fill, so they are chip-only.
 * Faking a front-facing back highlight would be worse than being silent about it.
 */
@Component({
  selector: 'vox-muscle-map',
  standalone: true,
  imports: [VoxBadgeComponent],
  templateUrl: './vox-muscle-map.component.html',
  styleUrl: './vox-muscle-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxMuscleMapComponent {
  readonly week = input.required<readonly MuscleWeekRow[]>();
  readonly sessions = input(0);
  /** Exercises still awaiting classification; drives the caveat line. */
  readonly pending = input(0);

  private readonly hitKeys = computed(() => new Set(this.week().map((r) => r.muscle)));

  /** The two biggest groups by volume — the ones shown in jade. */
  private readonly topKeys = computed(
    () =>
      new Set(
        [...this.week()]
          .sort((a, b) => b.volumeKg - a.volumeKg)
          .slice(0, 2)
          .map((r) => r.muscle),
      ),
  );

  protected readonly chips = computed((): MuscleChip[] => {
    const hit = this.hitKeys();
    return MUSCLE_ORDER.filter((key) => key !== 'other' || hit.has('other')).map((key) => ({
      key,
      label: MUSCLE_LABELS[key],
      hit: hit.has(key),
    }));
  });

  protected readonly hasData = computed(() => this.week().length > 0);

  protected readonly caption = computed(() => {
    const n = this.sessions();
    const base = `Based on ${n} logged session${n === 1 ? '' : 's'}`;
    const p = this.pending();
    return p > 0 ? `${base} · ${p} still being worked out` : base;
  });

  /** Fill for a body region: jade if a top group, brand if trained, else muted. */
  protected fill(key: MuscleGroupKey): string {
    if (this.topKeys().has(key)) return 'var(--vox-jade)';
    if (this.hitKeys().has(key)) return 'var(--vox-brand)';
    return 'rgba(255, 255, 255, 0.13)';
  }

  protected chipTone(chip: MuscleChip): 'jade' | 'brand' | 'neutral' {
    if (!chip.hit) return 'neutral';
    return this.topKeys().has(chip.key) ? 'jade' : 'brand';
  }
}
