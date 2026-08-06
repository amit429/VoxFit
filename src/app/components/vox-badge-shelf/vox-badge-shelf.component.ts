import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { VoxEarnedBadge } from '@/app/models';

/**
 * Achievement shelf. Locked badges stay visible as dashed outlines — the
 * point is to show what is reachable next, not to hide it.
 *
 * Badges are currently derived client-side from live counts, so there is no
 * earned-at date. See Deferred #3 in REVAMP-PROGRESS.md.
 */
@Component({
  selector: 'vox-badge-shelf',
  standalone: true,
  templateUrl: './vox-badge-shelf.component.html',
  styleUrl: './vox-badge-shelf.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxBadgeShelfComponent {
  readonly badges = input.required<readonly VoxEarnedBadge[]>();
  /** How many tiles to show; the rest count toward the "n of m" tally only. */
  readonly visible = input(5);

  protected readonly earnedCount = computed(() => this.badges().filter((b) => b.earned).length);

  protected readonly totalCount = computed(() => this.badges().length);

  /**
   * Earned badges first, then the nearest locked ones — so the shelf always
   * shows achievements plus the next targets rather than a wall of padlocks.
   */
  protected readonly shown = computed(() => {
    const all = this.badges();
    return [...all.filter((b) => b.earned), ...all.filter((b) => !b.earned)].slice(
      0,
      this.visible(),
    );
  });
}
