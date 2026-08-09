import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { DietLogListRow } from '@/app/models';
import { mealEmoji } from '@/app/utils/meal-display.util';

/**
 * One logged meal. Extracted because the Fuel screen renders this same row in
 * both its day and week views, and the two copies had already drifted apart.
 */
@Component({
  selector: 'vox-meal-row',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './vox-meal-row.component.html',
  styleUrl: './vox-meal-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxMealRowComponent {
  readonly log = input.required<DietLogListRow>();
  /** Small line above the name — a time, or a date for week view. */
  readonly timeLabel = input('');

  readonly openRecipe = output<DietLogListRow>();

  protected readonly emoji = computed(() => mealEmoji(this.log()));
}
