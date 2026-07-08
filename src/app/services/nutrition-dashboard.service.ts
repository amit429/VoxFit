import { Injectable, computed, inject, signal } from '@angular/core';
import type { HomeMacrosMock, MacroRowMock } from '@/app/data/types';
import { AuthService } from '@/app/services/auth.service';
import { SupabaseService } from '@/app/services/supabase.service';
import { parseLocalDateKey } from '@/app/utils/workout-display.util';

@Injectable({ providedIn: 'root' })
export class NutritionDashboardService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly loadState = signal<'idle' | 'loading' | 'error'>('idle');
  readonly lastError = signal<string | null>(null);

  /** Aggregates for local calendar day. */
  private readonly totals = signal({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  readonly macros = computed((): HomeMacrosMock => {
    const p = this.auth.profile();
    const t = this.totals();
    const targetCal = Math.max(0, Math.round(p?.target_calories ?? 2200));
    const targetProt = Math.max(0, Math.round(p?.target_protein_g ?? 160));
    const targetCarbs = Math.max(0, Math.round(p?.target_carbs_g ?? 250));
    const targetFat = Math.max(0, Math.round(p?.target_fat_g ?? 65));

    const rows: MacroRowMock[] = [
      { label: 'Calories', current: Math.round(t.calories), target: targetCal },
      { label: 'Protein', current: Math.round(t.protein), target: targetProt },
      { label: 'Carbs', current: Math.round(t.carbs), target: targetCarbs },
      { label: 'Fat', current: Math.round(t.fat), target: targetFat },
    ];

    const nothing =
      t.calories <= 0 && t.protein <= 0 && t.carbs <= 0 && t.fat <= 0;

    if (nothing) {
      return {
        rows,
        hint: 'No meals logged today yet — open Diet, describe your pantry, and log a meal to track macros here.',
      };
    }

    const hints: string[] = [];
    if (targetProt > 0 && t.protein < targetProt * 0.85) {
      hints.push(`${Math.max(0, Math.round(targetProt - t.protein))}g protein left to hit today’s target`);
    }
    if (targetCal > 0 && t.calories > targetCal * 1.05) {
      hints.push(`Calories slightly above target — balance later today if you prefer`);
    }

    return {
      rows,
      hint: hints.length > 0 ? hints[0] : undefined,
    };
  });

  async refresh(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) {
      this.totals.set({ calories: 0, protein: 0, carbs: 0, fat: 0 });
      this.loadState.set('idle');
      this.lastError.set(null);
      return;
    }

    const today = parseLocalDateKey(new Date());
    this.loadState.set('loading');
    this.lastError.set(null);

    const { data, error } = await this.supabase.client
      .from('diet_logs')
      .select('calories, protein_g, carbs_g, fat_g')
      .eq('user_id', uid)
      .eq('date', today);

    if (error) {
      console.error('[NutritionDashboard]', error);
      this.lastError.set(error.message);
      this.loadState.set('error');
      return;
    }

    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    for (const row of data ?? []) {
      calories += Number(row['calories'] ?? 0);
      protein += Number(row['protein_g'] ?? 0);
      carbs += Number(row['carbs_g'] ?? 0);
      fat += Number(row['fat_g'] ?? 0);
    }

    this.totals.set({ calories, protein, carbs, fat });
    this.loadState.set('idle');
  }
}
