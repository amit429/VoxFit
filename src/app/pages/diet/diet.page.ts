import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';
import { VoxSkeletonComponent } from '@/app/components/vox-skeleton/vox-skeleton.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { VoxSegmentedComponent } from '@/app/components/vox-segmented/vox-segmented.component';
import { VoxMealRowComponent } from '@/app/components/vox-meal-row/vox-meal-row.component';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRouterLinkWithHref,
  IonButtons,
  IonModal,
  IonButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  micOutline,
  statsChartOutline,
  flashOutline,
  warningOutline,
  chevronBackOutline,
  chevronForwardOutline,
  restaurantOutline,
} from 'ionicons/icons';
import type { DayGroupVm, DietLogListRow, DietMealTypeDb, MealSectionVm } from '@/app/models';
import { DietLogService } from '@/app/services/diet-log.service';
import { NutritionDashboardService } from '@/app/services/nutrition-dashboard.service';
import { AuthService } from '@/app/services/auth.service';
import { getWeekBoundsForDate, parseIsoDateLocal, parseLocalDateKey } from '@/app/utils/workout-display.util';

addIcons({
  micOutline,
  statsChartOutline,
  flashOutline,
  warningOutline,
  chevronBackOutline,
  chevronForwardOutline,
  restaurantOutline,
});

const MEAL_LABELS: Record<DietMealTypeDb, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const MEAL_ORDER: readonly DietMealTypeDb[] = ['breakfast', 'lunch', 'dinner', 'snack'];

@Component({
  selector: 'app-diet',
  standalone: true,
  templateUrl: './diet.page.html',
  styleUrls: ['./diet.page.scss'],
  imports: [
    VoxIconComponent,
    VoxSkeletonComponent,
    VoxCardComponent,
    VoxBadgeComponent,
    VoxSegmentedComponent,
    VoxMealRowComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    RouterLink,
    IonRouterLinkWithHref,
    IonButtons,
    IonModal,
    IonButton,
  ],
})
export class DietPage implements ViewWillEnter {
  protected readonly nutrition = inject(NutritionDashboardService);
  protected readonly dietLog = inject(DietLogService);
  protected readonly auth = inject(AuthService);

  /** Which day is focused for navigation (day view = that day; week view = week containing this day). */
  protected readonly focusDateKey = signal<string>(parseLocalDateKey(new Date()));
  protected readonly rangeMode = signal<'day' | 'week'>('day');
  protected readonly mealTypeFilter = signal<'all' | DietMealTypeDb>('all');

  protected readonly rawLogs = signal<readonly DietLogListRow[]>([]);
  protected readonly logsError = signal<string | null>(null);
  /**
   * Starts true. `ionViewWillEnter` always kicks off a fetch, so a false default
   * meant the first frame rendered "Nothing logged yet" before the query even
   * began — an empty state asserted before looking.
   */
  protected readonly logsLoading = signal(true);

  protected readonly recipeModalLog = signal<DietLogListRow | null>(null);

  protected readonly macros = computed(() => this.nutrition.macros());

  /** Overall calorie % + a calorie-weighted P/C/F stacked-bar breakdown (protein/carbs = 4 kcal/g, fat = 9 kcal/g). */
  protected readonly macroSummary = computed(() => {
    const rows = this.macros().rows;
    const cal = rows.find((r) => r.label === 'Calories');
    const protein = rows.find((r) => r.label === 'Protein');
    const carbs = rows.find((r) => r.label === 'Carbs');
    const fat = rows.find((r) => r.label === 'Fat');
    const target = cal?.target ?? 0;
    const pct = target > 0 && cal ? Math.min(100, Math.round((cal.current / target) * 100)) : 0;

    const kcalWidth = (row: typeof protein, kcalPerG: number) =>
      row && target > 0 ? Math.min(100, ((row.current * kcalPerG) / target) * 100) : 0;

    return {
      pct,
      calories: cal ?? null,
      segments: [
        { label: 'Protein', row: protein, widthPct: kcalWidth(protein, 4) },
        { label: 'Carbs', row: carbs, widthPct: kcalWidth(carbs, 4) },
        { label: 'Fat', row: fat, widthPct: kcalWidth(fat, 9) },
      ] as const,
    };
  });

  protected readonly daySections = computed((): readonly MealSectionVm[] => {
    if (this.rangeMode() !== 'day') return [];
    return groupLogsByMealSections(this.rawLogs());
  });

  protected readonly weekDayGroups = computed((): readonly DayGroupVm[] => {
    if (this.rangeMode() !== 'week') return [];
    return groupWeekByDate(this.rawLogs());
  });

  protected readonly rangeSummaryLabel = computed(() => {
    const mode = this.rangeMode();
    const key = this.focusDateKey();
    if (mode === 'day') {
      return formatDateHeading(key);
    }
    const { monday, sunday } = getWeekBoundsForDate(key);
    const a = parseIsoDateLocal(monday);
    const b = parseIsoDateLocal(sunday);
    const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    const left = a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const right = sameMonth
      ? b.toLocaleDateString(undefined, { day: 'numeric' })
      : b.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${left} – ${right}`;
  });

  protected readonly rangeSegments = [
    { id: 'day' as const, label: 'Day' },
    { id: 'week' as const, label: 'Week' },
  ];

  /** Ring geometry — r=43 in a 106px box, matching the mockup. */
  protected readonly calorieCircumference = 2 * Math.PI * 43;

  protected readonly calorieDashOffset = computed(
    () => this.calorieCircumference * (1 - this.macroSummary().pct / 100),
  );

  /** Headline reads as remaining-to-go, or as an overshoot once past target. */
  protected readonly calorieHeadline = computed(() => {
    const cal = this.macroSummary().calories;
    if (!cal) return '—';
    const left = cal.target - cal.current;
    if (left > 0) return `${left.toLocaleString()} kcal left`;
    if (left === 0) return 'Target hit';
    return `${Math.abs(left).toLocaleString()} kcal over`;
  });

  /** Series colour per macro — same assignment as Home's fuel card. */
  protected macroTrackColor(label: string): string {
    switch (label) {
      case 'Protein':
        return 'var(--vox-jade)';
      case 'Carbs':
        return 'var(--vox-slate)';
      default:
        return 'var(--vox-apricot)';
    }
  }

  protected readonly mealTypeChips: { id: 'all' | DietMealTypeDb; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'dinner', label: 'Dinner' },
    { id: 'snack', label: 'Snack' },
  ];

  ionViewWillEnter(): void {
    void this.nutrition.refresh();
    void this.auth.refreshProfile();
    void this.loadLogs();
  }

  protected setRangeMode(mode: 'day' | 'week'): void {
    this.rangeMode.set(mode);
    void this.loadLogs();
  }

  protected setMealFilter(id: 'all' | DietMealTypeDb): void {
    this.mealTypeFilter.set(id);
    void this.loadLogs();
  }

  protected shiftFocusDay(delta: number): void {
    const d = parseIsoDateLocal(this.focusDateKey());
    d.setDate(d.getDate() + delta);
    this.focusDateKey.set(parseLocalDateKey(d));
    void this.loadLogs();
  }

  protected shiftFocusWeek(delta: number): void {
    const d = parseIsoDateLocal(this.focusDateKey());
    d.setDate(d.getDate() + delta * 7);
    this.focusDateKey.set(parseLocalDateKey(d));
    void this.loadLogs();
  }

  protected onPickDate(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (v?.match(/^\d{4}-\d{2}-\d{2}$/)) {
      this.focusDateKey.set(v);
      void this.loadLogs();
    }
  }

  protected openRecipe(log: DietLogListRow, ev?: Event): void {
    ev?.stopPropagation?.();
    this.recipeModalLog.set(log);
  }

  protected closeRecipe(): void {
    this.recipeModalLog.set(null);
  }

  protected recipeLines(log: DietLogListRow | null): string[] {
    if (!log?.recipe_text?.trim()) {
      return ['No recipe was saved for this meal.'];
    }
    return log.recipe_text
      .split('\n')
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
  }

  protected timeLabel(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  protected dateLineForLog(log: DietLogListRow): string {
    const d = parseIsoDateLocal(log.date);
    const today = parseLocalDateKey(new Date());
    if (log.date === today) {
      return `Today · ${this.timeLabel(log.created_at)}`;
    }
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = parseLocalDateKey(y);
    if (log.date === yesterday) {
      return `Yesterday · ${this.timeLabel(log.created_at)}`;
    }
    return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${this.timeLabel(log.created_at)}`;
  }

  private async loadLogs(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) {
      this.rawLogs.set([]);
      this.logsError.set(null);
      return;
    }
    this.logsLoading.set(true);
    this.logsError.set(null);
    try {
      const focus = this.focusDateKey();
      const mode = this.rangeMode();
      let from: string;
      let to: string;
      if (mode === 'day') {
        from = focus;
        to = focus;
      } else {
        const w = getWeekBoundsForDate(focus);
        from = w.monday;
        to = w.sunday;
      }
      const mt = this.mealTypeFilter();
      const rows = await this.dietLog.listLogsInRange(uid, from, to, mt === 'all' ? undefined : mt);
      this.rawLogs.set(rows);
    } catch (err) {
      console.error('[DietPage] load logs', err);
      this.logsError.set(err instanceof Error ? err.message : 'Could not load meals');
      this.rawLogs.set([]);
    } finally {
      this.logsLoading.set(false);
    }
  }
}

function groupLogsByMealSections(logs: readonly DietLogListRow[]): MealSectionVm[] {
  const other: DietLogListRow[] = [];
  const byType = new Map<DietMealTypeDb, DietLogListRow[]>();
  for (const t of MEAL_ORDER) {
    byType.set(t, []);
  }
  for (const log of logs) {
    if (!log.meal_type) {
      other.push(log);
      continue;
    }
    byType.get(log.meal_type)?.push(log);
  }
  const out: MealSectionVm[] = [];
  for (const t of MEAL_ORDER) {
    const items = byType.get(t) ?? [];
    if (items.length) {
      out.push({ key: t, label: MEAL_LABELS[t], items });
    }
  }
  if (other.length) {
    out.push({ key: 'other', label: 'Other', items: other });
  }
  return out;
}

function groupWeekByDate(logs: readonly DietLogListRow[]): DayGroupVm[] {
  const byDate = new Map<string, DietLogListRow[]>();
  for (const log of logs) {
    const arr = byDate.get(log.date) ?? [];
    arr.push(log);
    byDate.set(log.date, arr);
  }
  const keys = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
  return keys.map((dateKey) => ({
    dateKey,
    dateHeading: formatDateHeading(dateKey),
    sections: groupLogsByMealSections(byDate.get(dateKey) ?? []).map((s) => ({
      ...s,
      trackId: `${dateKey}::${s.key}`,
    })),
  }));
}

function formatDateHeading(dateKey: string): string {
  const today = parseLocalDateKey(new Date());
  if (dateKey === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (dateKey === parseLocalDateKey(y)) return 'Yesterday';
  const d = parseIsoDateLocal(dateKey);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
