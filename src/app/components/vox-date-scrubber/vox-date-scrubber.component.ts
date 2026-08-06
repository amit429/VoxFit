import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { parseLocalDateKey, parseIsoDateLocal } from '@/app/utils/workout-display.util';

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

/**
 * Week strip for picking a day. Future days are disabled — you cannot log
 * forward, so offering them would be a dead affordance.
 */
@Component({
  selector: 'vox-date-scrubber',
  standalone: true,
  templateUrl: './vox-date-scrubber.component.html',
  styleUrl: './vox-date-scrubber.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxDateScrubberComponent {
  /** Local `YYYY-MM-DD` keys, Monday-first. Use `getCurrentWeekDayKeys()`. */
  readonly dayKeys = input.required<readonly string[]>();
  readonly selected = input.required<string>();

  readonly selectedChange = output<string>();

  protected readonly days = computed(() => {
    const todayKey = parseLocalDateKey(new Date());
    return this.dayKeys().map((key, i) => {
      const date = parseIsoDateLocal(key);
      return {
        key,
        weekday: WEEKDAY_LABELS[i] ?? '',
        dayOfMonth: date.getDate(),
        isToday: key === todayKey,
        isFuture: key > todayKey,
      };
    });
  });

  protected onPick(key: string, isFuture: boolean): void {
    if (isFuture) return;
    this.selectedChange.emit(key);
  }
}
