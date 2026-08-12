import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  BadgeMetric,
  BadgeProgressRow,
  MoodDb,
  MuscleBreakdown,
  MuscleGroupKey,
  MuscleShareRow,
  MuscleWeekRow,
  UserProgressStats,
  WeeklyVolumePoint,
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
  getWeekBoundsForDate,
  moodEmoji,
  moodLabel,
  parseLocalDateKey,
  parseSetLines,
  sessionTotalVolumeKg,
} from '@/app/utils/workout-display.util';

const SESSION_DETAIL_COLUMNS = `
  id, user_id, date, session_label, ai_summary, mood, energy_level, physical_flags, created_at,
  exercises_logged (
    id, session_id, exercise_name, exercise_type, sets, reps, weight_kg,
    duration_secs, distance_km, is_pr, pr_source, summary_line, set_lines
  )
`;

const JOURNAL_PAGE_SIZE = 20;

/**
 * Bounds for the strength-trend query, in one place rather than at each call
 * site. This is a cost knob: the window caps how many sessions are fetched,
 * and the top-N caps how many exercises are considered for the default
 * subject. Widen deliberately, not incidentally.
 */
export const TREND_WINDOW_WEEKS = 8;
export const TREND_TOP_EXERCISES = 5;

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
      hasFlags: flag.hasFlags,
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
      mood: isMoodDb(session.mood) ? session.mood : null,
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

  /**
   * What was trained this week, and the all-time split by muscle group.
   *
   * Both come from one RPC over the `primary_muscle` column that the insert
   * trigger denormalizes — so this is a pair of indexed aggregates, not a
   * classify-on-read. Week bounds are passed from the client so the week is the
   * user's own Monday rather than the server's.
   */
  async getMuscleBreakdown(): Promise<MuscleBreakdown> {
    const { monday, sunday } = getWeekBoundsForDate(parseLocalDateKey(new Date()));
    const { data, error } = await this.supabase.client.rpc('get_muscle_breakdown', {
      p_week_start: monday,
      p_week_end: sunday,
    });

    if (error) {
      console.error('[WorkoutJournal] muscle breakdown', error);
      throw new Error(error.message);
    }

    return normalizeMuscleBreakdown(data);
  }

  /**
   * Top-set-per-session series for one exercise, oldest first.
   *
   * "Top set" is the heaviest weight logged in that session, which is what the
   * chart is actually about — a light back-off set after a PR shouldn't pull
   * the line down. Sessions where the exercise was logged without a weight
   * (cardio, bodyweight) are skipped rather than plotted as zero.
   */
  async getExerciseTrend(
    userId: string,
    exerciseName: string,
    weeks = TREND_WINDOW_WEEKS,
  ): Promise<{ dateKey: string; topWeightKg: number; isPr: boolean }[]> {
    const from = new Date();
    from.setDate(from.getDate() - weeks * 7);

    const { data, error } = await this.supabase.client
      .from('workout_sessions')
      .select('date, exercises_logged!inner(exercise_name, weight_kg, is_pr, set_lines)')
      .eq('user_id', userId)
      .eq('exercises_logged.exercise_name', exerciseName)
      .gte('date', parseLocalDateKey(from))
      .order('date', { ascending: true });

    if (error) {
      console.error('[WorkoutJournal] exercise trend', error);
      throw new Error(error.message);
    }

    const rows = (data ?? []) as unknown as {
      date: string | null;
      exercises_logged: { weight_kg: number | string | null; is_pr: boolean | null; set_lines: unknown }[] | null;
    }[];

    /* Built with push rather than flatMap — this tsconfig's lib predates it. */
    const out: { dateKey: string; topWeightKg: number; isPr: boolean }[] = [];
    for (const row of rows) {
      if (!row.date) continue;
      const logged = row.exercises_logged ?? [];

      const weights: number[] = [];
      for (const ex of logged) {
        const lines = parseSetLines(ex.set_lines);
        const fromLines = lines
          .map((l) => l.weight_kg)
          .filter((w): w is number => w != null && Number.isFinite(w) && w > 0);
        if (fromLines.length > 0) {
          weights.push(...fromLines);
          continue;
        }
        const direct = ex.weight_kg == null ? null : Number(ex.weight_kg);
        if (direct != null && Number.isFinite(direct) && direct > 0) weights.push(direct);
      }

      if (weights.length === 0) continue;
      out.push({
        dateKey: row.date,
        topWeightKg: Math.max(...weights),
        isPr: logged.some((ex) => ex.is_pr),
      });
    }
    return out;
  }

  /**
   * Distinct exercise names by frequency within the trend window, most-logged
   * first. Used to pick a sensible default subject for the trend chart rather
   * than making the user choose before they have seen the thing.
   */
  async listTopExercises(userId: string, limit = TREND_TOP_EXERCISES): Promise<string[]> {
    const from = new Date();
    from.setDate(from.getDate() - TREND_WINDOW_WEEKS * 7);

    const { data, error } = await this.supabase.client
      .from('workout_sessions')
      .select('date, exercises_logged!inner(exercise_name, exercise_type)')
      .eq('user_id', userId)
      .gte('date', parseLocalDateKey(from));

    if (error) {
      console.error('[WorkoutJournal] top exercises', error);
      throw new Error(error.message);
    }

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as unknown as {
      exercises_logged: { exercise_name: string; exercise_type: string | null }[] | null;
    }[]) {
      for (const ex of row.exercises_logged ?? []) {
        /* Cardio has no meaningful top-set weight, so it never leads the chart. */
        if (ex.exercise_type === 'cardio') continue;
        counts.set(ex.exercise_name, (counts.get(ex.exercise_name) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name]) => name);
  }

  /**
   * Weekly training tonnage, oldest first, weeks without volume omitted.
   *
   * One aggregate RPC rather than a client-side sum: volume lives in
   * `set_lines`, the column every list query deliberately skips because it is
   * the expensive one. `computeVolumeTrend` fills the missing weeks in.
   */
  async getWeeklyVolumeSeries(): Promise<WeeklyVolumePoint[]> {
    const { data, error } = await this.supabase.client.rpc('get_weekly_volume_series');

    if (error) {
      console.error('[WorkoutJournal] weekly volume series', error);
      throw new Error(error.message);
    }

    return normalizeWeeklyVolumeSeries(data);
  }

  /**
   * All-time counts, current streak and the badge shelf — one RPC.
   *
   * Replaces two count-only queries plus client-side badge evaluation. The same
   * call awards anything newly earned, so simply reading persists a badge; the
   * ledger lives in `user_badges` and only a security-definer function writes
   * it, which is why badges can no longer un-earn themselves when a streak
   * lapses.
   *
   * Today's local date is passed in deliberately: `workout_sessions.date` holds
   * the user's local date, so letting Postgres use its own `current_date` moves
   * the streak by a day for anyone far from UTC.
   */
  async getProgressStats(): Promise<UserProgressStats> {
    const { data, error } = await this.supabase.client.rpc('get_user_progress_stats', {
      p_today: parseLocalDateKey(new Date()),
    });

    if (error) {
      console.error('[WorkoutJournal] progress stats', error);
      throw new Error(error.message);
    }

    return normalizeProgressStats(data);
  }
}

const MUSCLE_KEYS: readonly MuscleGroupKey[] = [
  'chest',
  'back',
  'legs',
  'glutes',
  'shoulders',
  'arms',
  'core',
  'cardio',
  'other',
];

function isMuscleKey(value: unknown): value is MuscleGroupKey {
  return typeof value === 'string' && (MUSCLE_KEYS as readonly string[]).includes(value);
}

/** Same defensive coercion as the stats RPC — jsonb arrives as `unknown`. */
function normalizeMuscleBreakdown(raw: unknown): MuscleBreakdown {
  const obj = isRecord(raw) ? raw : {};

  const week: MuscleWeekRow[] = [];
  if (Array.isArray(obj['week'])) {
    for (const entry of obj['week']) {
      if (!isRecord(entry) || !isMuscleKey(entry['muscle'])) continue;
      week.push({
        muscle: entry['muscle'],
        volumeKg: nonNegativeInt(entry['volume_kg']),
        sessions: nonNegativeInt(entry['sessions']),
      });
    }
  }

  const overall: MuscleShareRow[] = [];
  if (Array.isArray(obj['overall'])) {
    for (const entry of obj['overall']) {
      if (!isRecord(entry) || !isMuscleKey(entry['muscle'])) continue;
      overall.push({
        muscle: entry['muscle'],
        volumeKg: nonNegativeInt(entry['volume_kg']),
        sharePct: nonNegativeInt(entry['share_pct']),
      });
    }
  }

  return {
    week,
    overall,
    weekSessions: nonNegativeInt(obj['week_sessions']),
    pending: nonNegativeInt(obj['pending']),
  };
}

/** Same defensive coercion as the other RPCs — jsonb arrives as `unknown`. */
function normalizeWeeklyVolumeSeries(raw: unknown): WeeklyVolumePoint[] {
  if (!Array.isArray(raw)) return [];
  const out: WeeklyVolumePoint[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const weekStart = entry['week_start'];
    /* A week key that isn't a date would silently break the densify walk. */
    if (typeof weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) continue;
    out.push({ weekStart, volumeKg: nonNegativeInt(entry['volume_kg']) });
  }
  return out;
}

/**
 * The RPC returns `jsonb`, which arrives as `unknown`. Coerce every field
 * explicitly rather than casting the payload — same discipline the Gemini
 * parsers use, and for the same reason: a shape change should degrade to a
 * sane default, not throw somewhere far from here.
 */
function normalizeProgressStats(raw: unknown): UserProgressStats {
  const obj = isRecord(raw) ? raw : {};
  return {
    workouts: nonNegativeInt(obj['workouts']),
    prs: nonNegativeInt(obj['prs']),
    streakDays: nonNegativeInt(obj['streak_days']),
    badges: normalizeBadgeRows(obj['badges']),
  };
}

/* Built with a loop rather than flatMap — this tsconfig's lib predates it. */
function normalizeBadgeRows(raw: unknown): BadgeProgressRow[] {
  if (!Array.isArray(raw)) return [];
  const out: BadgeProgressRow[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const key = typeof entry['badge_key'] === 'string' ? entry['badge_key'] : '';
    if (!key) continue;
    const earnedAt = entry['earned_at'];
    out.push({
      badge_key: key,
      metric: isBadgeMetric(entry['metric']) ? entry['metric'] : 'workouts',
      threshold: nonNegativeInt(entry['threshold']),
      earned_at: typeof earnedAt === 'string' ? earnedAt : null,
    });
  }
  return out;
}

function isBadgeMetric(value: unknown): value is BadgeMetric {
  return value === 'streak' || value === 'workouts' || value === 'prs';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonNegativeInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * `mood` arrives as free `string | null` from the DB row type. Narrow it here
 * rather than casting, so an unexpected value becomes null instead of a bad
 * union member that later filters silently fail to match.
 */
function isMoodDb(value: string | null): value is MoodDb {
  return value === 'positive' || value === 'neutral' || value === 'negative';
}

function pickLatestSession(sameDay: WorkoutSessionRow[]): WorkoutSessionRow {
  return [...sameDay].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0] ?? sameDay[0];
}
