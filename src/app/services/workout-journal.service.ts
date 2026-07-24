import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  ExerciseLoggedRow,
  HomeStreakMock,
  HomeWorkoutCardMock,
  WeeklyVolumeMock,
  WorkoutDetailMock,
  WorkoutSessionListMock,
  WorkoutSessionRow,
} from '@/app/models';
import { AuthService } from '@/app/services/auth.service';
import { SupabaseService } from '@/app/services/supabase.service';
import {
  buildWeekCompletionDots,
  buildWeekVolumeSeries,
  collectSessionDateSet,
  computeWorkoutStreakDays,
  energyDisplayLabel,
  energyShortLabel,
  exerciseListDetailLine,
  flagsSummary,
  formatSessionDateLabel,
  formatShortWeekdayLabelsForCurrentWeek,
  formatVolumeKg,
  getCurrentWeekDayKeys,
  moodEmoji,
  moodLabel,
  parseLocalDateKey,
  sessionTotalVolumeKg,
} from '@/app/utils/workout-display.util';

@Injectable({ providedIn: 'root' })
export class WorkoutJournalService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly loadState = signal<'idle' | 'loading' | 'error'>('idle');

  /** Full history for journal + aggregates (newest first). */
  readonly sessions = signal<WorkoutSessionRow[]>([]);

  /** Most recently logged session, if any — for the Home "recent parsed" recap. */
  readonly latestSession = computed(() => this.sessions()[0] ?? null);

  readonly streak = signal<HomeStreakMock>({ days: 0, weekDots: [] });

  /** Today's workout card — null when nothing logged today. */
  readonly todayWorkout = signal<HomeWorkoutCardMock | null>(null);
  readonly hasLoggedToday = signal(false);

  /** Current calendar week volume chart (strength tonnage kg). */
  readonly weeklyVolume = signal<WeeklyVolumeMock>({
    label: 'Weekly Volume (kg)',
    values: [0, 0, 0, 0, 0, 0, 0],
    dayLabels: [...formatShortWeekdayLabelsForCurrentWeek()],
  });

  readonly lastError = signal<string | null>(null);

  sessionToDetail(session: WorkoutSessionRow): WorkoutDetailMock {
    const ex = session.exercises_logged ?? [];
    const vol = sessionTotalVolumeKg(ex);
    const flag = flagsSummary(session.physical_flags);
    return {
      title: session.session_label?.trim() || 'Workout',
      dateLabel: session.date ? formatSessionDateLabel(session.date) : '—',
      moodEmoji: moodEmoji(session.mood),
      moodLabel: moodLabel(session.mood),
      energyLabel: energyDisplayLabel(session.energy_level),
      volumeLabel: formatVolumeKg(vol),
      coachNote: session.ai_summary?.trim() || 'No coach note for this session yet.',
      exercises: ex.map((row) => ({
        name: row.exercise_name,
        detail: exerciseListDetailLine(row),
        pr: !!row.is_pr,
      })),
      flagsTitle: flag.title,
      flagsBody: flag.body,
    };
  }

  sessionToListItem(session: WorkoutSessionRow): WorkoutSessionListMock {
    const ex = session.exercises_logged ?? [];
    const hasPr = ex.some((e) => e.is_pr);
    const flags = session.physical_flags?.some((f) => f.trim().length > 0);
    return {
      id: session.id,
      label: session.session_label?.trim() || 'Workout',
      dateLabel: session.date ? formatSessionDateLabel(session.date) : '—',
      dateKey: session.date ?? '',
      exercises: ex.length,
      moodEmoji: moodEmoji(session.mood),
      energyLabel: energyShortLabel(session.energy_level),
      hasFlag: !!flags,
      hasPr,
    };
  }

  async refresh(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) {
      this.sessions.set([]);
      this.applyEmptyAggregates();
      this.loadState.set('idle');
      return;
    }

    this.loadState.set('loading');
    this.lastError.set(null);

    const { data, error } = await this.supabase.client
      .from('workout_sessions')
      .select(
        `
        id, user_id, date, session_label, ai_summary, mood, energy_level, physical_flags, created_at, raw_transcript,
        exercises_logged (
          id, session_id, exercise_name, exercise_type, sets, reps, weight_kg,
          duration_secs, distance_km, is_pr, summary_line, set_lines
        )
      `
      )
      .eq('user_id', uid)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[WorkoutJournal]', error);
      this.loadState.set('error');
      this.lastError.set(error.message);
      return;
    }

    const rows = (data ?? []) as WorkoutSessionRow[];
    rows.sort((a, b) => {
      const ad = a.date ?? '';
      const bd = b.date ?? '';
      if (ad !== bd) return bd.localeCompare(ad);
      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    });
    this.sessions.set(rows);
    this.applyAggregates(rows);
    this.loadState.set('idle');
  }

  private applyEmptyAggregates(): void {
    const weekKeys = getCurrentWeekDayKeys();
    const shortLabels = formatShortWeekdayLabelsForCurrentWeek();
    this.streak.set({
      days: 0,
      weekDots: buildWeekCompletionDots(weekKeys, shortLabels, new Set()),
    });
    this.todayWorkout.set(null);
    this.hasLoggedToday.set(false);
    this.weeklyVolume.set({
      label: 'Weekly Volume (kg)',
      values: buildWeekVolumeSeries([], weekKeys),
      dayLabels: [...shortLabels],
    });
  }

  private applyAggregates(rows: WorkoutSessionRow[]): void {
    const weekKeys = getCurrentWeekDayKeys();
    const shortLabels = formatShortWeekdayLabelsForCurrentWeek();
    const weekKeySet = new Set(weekKeys);
    const dateSet = collectSessionDateSet(rows);
    this.streak.set({
      days: computeWorkoutStreakDays(dateSet),
      weekDots: buildWeekCompletionDots(weekKeys, shortLabels, dateSet),
    });

    const todayKey = parseLocalDateKey(new Date());
    const todays = rows.filter((r) => r.date === todayKey);
    if (todays.length === 0) {
      this.hasLoggedToday.set(false);
      this.todayWorkout.set(null);
    } else {
      this.hasLoggedToday.set(true);
      const primary = pickLatestSession(todays);
      const ex = primary.exercises_logged ?? [];
      const chips = ex.map((e) => e.exercise_name).slice(0, 6);
      const titleBit = primary.session_label?.trim() || 'Workout';
      this.todayWorkout.set({
        title: "Today's Workout",
        subtitle: `${titleBit} · ${ex.length} exercise${ex.length === 1 ? '' : 's'}`,
        statusLabel: 'Logged',
        statusTone: 'success',
        exerciseChips: chips,
        coachTitle: 'Coach Note',
        coachNote: primary.ai_summary?.trim() || 'Nice work today — keep the momentum going.',
      });
    }

    const sessionsThisWeek = rows.filter((r) => r.date && weekKeySet.has(r.date));
    const values = buildWeekVolumeSeries(sessionsThisWeek, weekKeys);
    this.weeklyVolume.set({
      label: 'Weekly Volume (kg)',
      values,
      dayLabels: [...shortLabels],
    });
  }
}

function pickLatestSession(sameDay: WorkoutSessionRow[]): WorkoutSessionRow {
  return [...sameDay].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0] ?? sameDay[0];
}
