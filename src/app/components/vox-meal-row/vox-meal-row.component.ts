import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { DietLogListRow } from '@/app/models';

/**
 * Emoji per meal type. `diet_logs` has no emoji column — AI-suggested meals
 * carry one transiently but it is never persisted — so the icon is derived
 * from `meal_type`. See Deferred #10.
 */
const MEAL_TYPE_EMOJI: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍗',
  snack: '🍎',
};

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

  protected readonly emoji = computed(() => MEAL_TYPE_EMOJI[this.log().meal_type ?? ''] ?? '🍽️');
}
