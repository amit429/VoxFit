import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonModal } from '@ionic/angular/standalone';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import type { DietLogListRow } from '@/app/models';
import { mealEmoji, mealTypeLabel, mealTypeTone } from '@/app/utils/meal-display.util';

/**
 * A logged meal, in full.
 *
 * Replaces a plain bottom sheet that showed a title, a date and a wall of
 * unnumbered steps over a large empty void — while ignoring the calories,
 * macros, prep time and AI rationale already on the row.
 *
 * The hero is the meal's emoji on a tinted wash, coloured by meal type. That is
 * the illustration: real food photography is not something this app has, and a
 * generated stock image would be a lie about what was eaten. The glyph is the
 * one the model picked for this dish, so it is at least about the food.
 */
@Component({
  selector: 'vox-recipe-modal',
  standalone: true,
  imports: [IonModal, DecimalPipe, VoxIconComponent, VoxCardComponent],
  templateUrl: './vox-recipe-modal.component.html',
  styleUrl: './vox-recipe-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxRecipeModalComponent {
  readonly log = input<DietLogListRow | null>(null);
  /** Formatted "Today · 4:14" line, built by the host from its own date helpers. */
  readonly dateLine = input('');

  readonly dismissed = output<void>();

  protected readonly isOpen = computed(() => this.log() !== null);

  protected readonly emoji = computed(() => mealEmoji(this.log()));
  protected readonly tone = computed(() => mealTypeTone(this.log()?.meal_type));
  protected readonly typeLabel = computed(() => mealTypeLabel(this.log()?.meal_type));

  protected readonly prepLabel = computed(() => {
    const mins = this.log()?.prep_minutes;
    return mins && mins > 0 ? `${mins} min` : '';
  });

  /**
   * Steps, with any leading "1." stripped — the numbering is rendered, so a
   * model that already numbered its output would otherwise show "1. 1.".
   */
  protected readonly steps = computed(() => {
    const text = this.log()?.recipe_text?.trim();
    if (!text) return [];
    return text
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean);
  });

  protected readonly macros = computed(() => {
    const l = this.log();
    if (!l) return [];
    return [
      { label: 'Protein', value: l.protein_g, tone: 'jade' },
      { label: 'Carbs', value: l.carbs_g, tone: 'slate' },
      { label: 'Fat', value: l.fat_g, tone: 'apricot' },
    ];
  });
}
