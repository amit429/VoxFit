import { Injectable, inject } from '@angular/core';
import type { DietMealSuggestion } from '@/app/models/diet-meals.models';
import { SupabaseService } from '@/app/services/supabase.service';
import { parseLocalDateKey } from '@/app/utils/workout-display.util';

export type DietMealTypeDb = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Row from `diet_logs` for list UI. */
export interface DietLogListRow {
  readonly id: string;
  /** Local calendar date `YYYY-MM-DD`. */
  readonly date: string;
  readonly meal_name: string;
  readonly meal_type: DietMealTypeDb | null;
  readonly calories: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  readonly prep_minutes: number | null;
  readonly rationale: string | null;
  readonly recipe_text: string | null;
  readonly created_at: string;
}

function inferMealType(date = new Date()): DietMealTypeDb {
  const h = date.getHours();
  if (h < 11) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 18) return 'dinner';
  return 'snack';
}

function recipeStepsToText(steps: readonly string[]): string {
  return steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

@Injectable({ providedIn: 'root' })
export class DietLogService {
  private readonly supabase = inject(SupabaseService);

  async logSuggestedMeal(userId: string, meal: DietMealSuggestion): Promise<void> {
    const dateStr = parseLocalDateKey(new Date());
    const row = {
      user_id: userId,
      date: dateStr,
      meal_name: meal.name,
      meal_type: inferMealType(),
      calories: Math.round(meal.calories),
      protein_g: meal.proteinG,
      carbs_g: meal.carbsG,
      fat_g: meal.fatG,
      prep_minutes: meal.prepMinutes,
      rationale: meal.rationale,
      recipe_text: recipeStepsToText(meal.recipeSteps),
      source: 'ai_suggested' as const,
    };

    const { error } = await this.supabase.client.from('diet_logs').insert(row);
    if (error) {
      console.error('[DietLogService]', error);
      throw new Error(error.message);
    }
  }

  /** Meals on one calendar day (`YYYY-MM-DD`). Newest first. */
  async listLogsForDate(userId: string, dateKey: string): Promise<DietLogListRow[]> {
    return this.listLogsInRange(userId, dateKey, dateKey);
  }

  /**
   * Meals in an inclusive date range. Newest `date` first, then `created_at`.
   * Optional `mealType` filters to one category.
   */
  async listLogsInRange(
    userId: string,
    fromDate: string,
    toDate: string,
    mealType?: DietMealTypeDb,
  ): Promise<DietLogListRow[]> {
    let q = this.supabase.client
      .from('diet_logs')
      .select(
        'id, date, meal_name, meal_type, calories, protein_g, carbs_g, fat_g, prep_minutes, rationale, recipe_text, created_at',
      )
      .eq('user_id', userId)
      .gte('date', fromDate)
      .lte('date', toDate);

    if (mealType) {
      q = q.eq('meal_type', mealType);
    }

    const { data, error } = await q
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DietLogService] list range', error);
      throw new Error(error.message);
    }
    return (data ?? []).map((r) => normalizeLogRow(r as unknown as Record<string, unknown>));
  }
}

function normalizeLogRow(r: Record<string, unknown>): DietLogListRow {
  const mt = r['meal_type'];
  const meal_type =
    mt === 'breakfast' || mt === 'lunch' || mt === 'dinner' || mt === 'snack' ? mt : null;
  const dateRaw = r['date'];
  const date =
    typeof dateRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ?
      dateRaw
    : parseLocalDateKey(new Date());
  const rt = r['recipe_text'];
  const recipe_text = rt == null || String(rt).trim() === '' ? null : String(rt).trim();
  return {
    id: String(r['id'] ?? ''),
    date,
    meal_name: String(r['meal_name'] ?? 'Meal'),
    meal_type,
    calories: Math.round(Number(r['calories'] ?? 0)),
    protein_g: Number(r['protein_g'] ?? 0),
    carbs_g: Number(r['carbs_g'] ?? 0),
    fat_g: Number(r['fat_g'] ?? 0),
    prep_minutes: r['prep_minutes'] == null ? null : Math.round(Number(r['prep_minutes'])),
    rationale: r['rationale'] == null ? null : String(r['rationale']),
    recipe_text,
    created_at: String(r['created_at'] ?? ''),
  };
}
