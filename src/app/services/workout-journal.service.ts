import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  HomeStreakMock,
  HomeWorkoutCardMock,
  WeeklyVolumeMock,
  WorkoutDetailMock,
  WorkoutSessionListMock,
  WorkoutSessionListRow,
  WorkoutSessionRow,
  WorkoutActivityRow,
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

const SESSION_DETAIL_COLUMNS = `
  id, user_id, date, session_label, ai_summary, mood, energy_level, physical_flags, created_at,
  exercises_logged (
    id, session_id, exercise_name, exercise_type, sets, reps, weight_kg,
    duration_secs, distance_km, is_pr, summary_line, set_lines
  )
`;

const JOURNAL_PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class WorkoutJournalService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly lastError = signal<string | null>(null);

  // ---- Activity summary: bounded 366-day window of just (id, date) — powers
  // streak/week-dots (Home) and the 26-week heatmap + 6-month chart (Profile).
  // 366 days is not arbitrary: computeWorkoutStreakDays() never walks back
  // further than that regardless of history depth, so this window is
  // equivalent to an unbounded fetch for streak purposes while comfortably
  // covering both Profile charts too.
  readonly activityRows = signal<WorkoutActivityRow[]>([]);
  readonly activityLoadState = signal<'idle' | 'loading' | 'error'>('idle');
  readonly activityLoaded = signal(false);

  readonly streak = computed<HomeStreakMock>(() => {
    const weekKeys = getCurrentWeekDayKeys();
    const shortLabels = formatShortWeekdayLabelsForCurrentWeek();
    const dateSet = collectSessionDateSet(this.activityRows());
    return {
      days: computeWorkoutStreakDays(dateSet),
      weekDots: buildWeekCompletionDots(weekKeys, shortLabels, dateSet),
    };
  });

  // ---- Current-week sessions: full detail (incl. set_lines) for the current
  // calendar week only — shared by Home (today's card + weekly volume) and
  // the Journal page's default "week" filter.
  readonly weekSessions = signal<WorkoutSessionRow[]>([]);
  readonly weekSessionsLoadState = signal<'idle' | 'loading' | 'error'>('idle');
  readonly weekSessionsLoaded = signal(false);

  readonly weeklyVolume = computed<WeeklyVolumeMock>(() => {
    const weekKeys = getCurrentWeekDayKeys();
    const shortLabels = formatShortWeekdayLabelsForCurrentWeek();
    return {
      label: 'Weekly Volume (kg)',
      values: buildWeekVolumeSeries(this.weekSessions(), weekKeys),
      dayLabels: [...shortLabels],
    };
  });

  readonly hasLoggedToday = computed(() => {
    const todayKey = parseLocalDateKey(new Date());
    return this.weekSessions().some((r) => r.date === todayKey);
  });

  readonly todayWorkout = computed<HomeWorkoutCardMock | null>(() => {
    const todayKey = parseLocalDateKey(new Date());
    const todays = this.weekSessions().filter((r) => r.date === todayKey);
    if (todays.length === 0) return null;
    const primary = pickLatestSession(todays);
    const ex = primary.exercises_logged ?? [];
    const titleBit = primary.session_label?.trim() || 'Workout';
    return {
      title: "Today's Workout",
      subtitle: `${titleBit} · ${ex.length} exercise${ex.length === 1 ? '' : 's'}`,
      statusLabel: 'Logged',
      statusTone: 'success',
      exerciseChips: ex.map((e) => e.exercise_name).slice(0, 6),
      coachTitle: 'Coach Note',
      coachNote: primary.ai_summary?.trim() || 'Nice work today — keep the momentum going.',
    };
  });

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

  sessionToListItem(session: {
    id: string;
    session_label: string | null;
    date: string | null;
    mood: string | null;
    energy_level: string | null;
    physical_flags: string[] | null;
    exercises_logged: { is_pr: boolean | null }[] | null;
  }): WorkoutSessionListMock {
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

  async refreshActivitySummary(days = 366): Promise<void> {
    try {
      const uid = this.auth.user()?.id;
      if (!uid) {
        this.activityRows.set([]);
        this.activityLoadState.set('idle');
        return;
      }
      this.activityLoadState.set('loading');
      this.lastError.set(null);

      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - (days - 1));

      const { data, error } = await this.supabase.client
        .from('workout_sessions')
        .select('id, date')
        .eq('user_id', uid)
        .gte('date', parseLocalDateKey(from))
        .lte('date', parseLocalDateKey(today))
        .order('date', { ascending: false });

      if (error) {
        console.error('[WorkoutJournal] activity summary', error);
        this.activityLoadState.set('error');
        this.lastError.set(error.message);
        return;
      }
      this.activityRows.set((data ?? []) as WorkoutActivityRow[]);
      this.activityLoadState.set('idle');
    } finally {
      this.activityLoaded.set(true);
    }
  }

  async refreshCurrentWeekSessions(): Promise<void> {
    try {
      const uid = this.auth.user()?.id;
      if (!uid) {
        this.weekSessions.set([]);
        this.weekSessionsLoadState.set('idle');
        return;
      }
      this.weekSessionsLoadState.set('loading');
      this.lastError.set(null);
      const keys = getCurrentWeekDayKeys();
      this.weekSessions.set(await this.listSessionsInRange(uid, keys[0] ?? '', keys[6] ?? ''));
      this.weekSessionsLoadState.set('idle');
    } catch (err) {
      console.error('[WorkoutJournal] week sessions', err);
      this.weekSessionsLoadState.set('error');
      this.lastError.set(err instanceof Error ? err.message : 'Could not load this week');
    } finally {
      this.weekSessionsLoaded.set(true);
    }
  }

  /** Full session + exercise detail (incl. `set_lines`) for a given inclusive date range. */
  async listSessionsInRange(userId: string, fromDate: string, toDate: string): Promise<WorkoutSessionRow[]> {
    const { data, error } = await this.supabase.client
      .from('workout_sessions')
      .select(SESSION_DETAIL_COLUMNS)
      .eq('user_id', userId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[WorkoutJournal] list range', error);
      throw new Error(error.message);
    }
    return (data ?? []) as unknown as WorkoutSessionRow[];
  }

  /** Paginated, lean-column fetch for the Journal page's "All"/"PRs" filters — never loads full history at once. */
  async listSessionsPage(
    userId: string,
    opts: { prOnly?: boolean; offset?: number; limit?: number } = {},
  ): Promise<{ items: WorkoutSessionListRow[]; hasMore: boolean }> {
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? JOURNAL_PAGE_SIZE;

    let q = this.supabase.client
      .from('workout_sessions')
      .select(
        opts.prOnly ?
          'id, date, session_label, mood, energy_level, physical_flags, created_at, exercises_logged!inner(id, is_pr)'
        : 'id, date, session_label, mood, energy_level, physical_flags, created_at, exercises_logged(id, is_pr)',
      )
      .eq('user_id', userId);

    if (opts.prOnly) {
      q = q.eq('exercises_logged.is_pr', true);
    }

    const { data, error } = await q
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      console.error('[WorkoutJournal] paged list', error);
      throw new Error(error.message);
    }

    const rows = (data ?? []) as unknown as WorkoutSessionListRow[];
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
  }

  /** Single full session by id — `WorkoutDetailPage`'s data source, independent of any cached list. */
  async getSessionById(userId: string, sessionId: string): Promise<WorkoutSessionRow | null> {
    const { data, error } = await this.supabase.client
      .from('workout_sessions')
      .select(SESSION_DETAIL_COLUMNS)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[WorkoutJournal] get by id', error);
      throw new Error(error.message);
    }
    return data as unknown as WorkoutSessionRow | null;
  }

  /** True all-time counts via count-only queries — cheap, no row data transferred. */
  async getAllTimeCounts(userId: string): Promise<{ workouts: number; prs: number }> {
    const [workoutsRes, prsRes] = await Promise.all([
      this.supabase.client.from('workout_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      this.supabase.client.from('exercises_logged').select('id', { count: 'exact', head: true }).eq('is_pr', true),
    ]);

    if (workoutsRes.error) throw new Error(workoutsRes.error.message);
    if (prsRes.error) throw new Error(prsRes.error.message);

    return { workouts: workoutsRes.count ?? 0, prs: prsRes.count ?? 0 };
  }
}

function pickLatestSession(sameDay: WorkoutSessionRow[]): WorkoutSessionRow {
  return [...sameDay].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0] ?? sameDay[0];
}
