/**
 * Defensive normalization for `workout_plans.plan`.
 *
 * Two callers, one function, deliberately:
 *   1. the generation path, where the JSON is fresh untrusted model output; and
 *   2. the read path, where a row may predate the current shape entirely.
 *
 * Rows written by the previous plan generator carry `days[].day_label`, a
 * free-text `days[].focus`, and `exercises[].reps` — no plan title, no focus
 * enum, no accommodations. Upgrading them here rather than making every field
 * optional keeps the components free of "old shape or new shape?" branching,
 * which is where this kind of migration usually rots.
 */
import type {
  GoalType,
  SportType,
  TrainingStatsSummary,
  WorkoutPlanAccommodation,
  WorkoutPlanContent,
  WorkoutPlanDay,
  WorkoutPlanExercise,
  WorkoutPlanFocus,
  WorkoutPlanNoteType,
} from '@/app/models';
import { WORKOUT_PLAN_FOCUSES, WORKOUT_PLAN_FOCUS_LABELS } from '@/app/models';

/** Anything longer than this is prose, not an exercise name — the model has drifted. */
const MAX_EXERCISE_NAME_LENGTH = 64;
const MAX_RATIONALE_SHORT_LENGTH = 220;

/**
 * Keyword → focus for legacy rows and for model output that ignored the enum.
 * Order matters: it is a first-match scan, so the specific patterns ("pull",
 * "chest") sit ahead of the catch-alls ("upper", "circuit"). `cardio` sits below
 * push/pull so "Upper Body & Cardio · pull focus" still reads as a pull day —
 * the lifting emphasis is what the user scans for, the conditioning is a rider.
 */
const FOCUS_KEYWORDS: readonly (readonly [WorkoutPlanFocus, readonly string[]])[] = [
  ['recovery', ['recovery', 'rest day', 'rest', 'mobility', 'stretch', 'yoga', 'deload', 'active recovery']],
  ['legs', ['leg', 'lower', 'quad', 'hamstring', 'glute', 'squat', 'calf', 'posterior chain']],
  ['pull', ['pull', 'back', 'lat', 'row', 'bicep', 'deadlift', 'chin-up', 'pull-up']],
  ['push', ['push', 'chest', 'shoulder', 'tricep', 'press', 'bench', 'delt']],
  ['cardio', ['cardio', 'run', 'bike', 'cycl', 'condition', 'hiit', 'liss', 'swim', 'erg', 'zone 2']],
  ['full', ['full', 'total', 'circuit', 'upper', 'compound', 'whole']],
];

const GOAL_LABELS: Readonly<Record<GoalType, string>> = {
  bulk: 'Build muscle',
  cut: 'Fat loss',
  maintain: 'Maintain',
};

const SPORT_LABELS: Readonly<Record<SportType, string>> = {
  gym: 'Gym',
  runner: 'Running',
  cyclist: 'Cycling',
  sport: 'Sport',
};

/** Plan-title suffix per goal, for legacy rows that never stored a title. */
const GOAL_TITLE_WORD: Readonly<Record<GoalType, string>> = {
  bulk: 'Build Split',
  cut: 'Cut Split',
  maintain: 'Training Split',
};

/**
 * Context pulled from outside the plan JSON itself. Legacy rows keep the
 * rationale in the `ai_rationale` column and the goal/sport in
 * `stats_snapshot`, so the normalizer needs both to reconstruct a hero card.
 */
export interface WorkoutPlanNormalizeContext {
  snapshot?: TrainingStatsSummary | null;
  aiRationale?: string | null;
  /** Days/week the user asked for, when the plan body does not say. */
  targetDaysPerWeek?: number | null;
}

export function normalizeWorkoutPlanContent(
  raw: unknown,
  context: WorkoutPlanNormalizeContext = {},
): WorkoutPlanContent {
  const o = isRecord(raw) ? raw : {};
  const daysRaw = Array.isArray(o['days']) ? o['days'] : [];
  const days = daysRaw
    .map((d, i) => normalizeDay(d, i))
    .filter((d): d is WorkoutPlanDay => d !== null)
    .map((d, i) => ({ ...d, day: i + 1 }));

  const snapshot = context.snapshot ?? null;
  const goal = snapshot?.goal ?? null;
  const sport = snapshot?.sportType ?? null;

  const goalLabel = text(o['goal_label']) || (goal ? GOAL_LABELS[goal] : '');
  const sportLabel = text(o['sport_label']) || (sport ? SPORT_LABELS[sport] : '');

  const trainingDays = days.filter((d) => d.focus !== 'recovery').length || days.length;
  const daysPerWeek =
    positiveInt(o['days_per_week']) ?? positiveInt(context.targetDaysPerWeek) ?? trainingDays;

  // Legacy rows have no rationale in the plan body — the column is the only copy.
  const legacyRationale = text(context.aiRationale);
  const rationaleFull = text(o['rationale_full']) || legacyRationale;
  const rationaleShort = clampText(
    text(o['rationale_short']) || firstSentences(rationaleFull),
    MAX_RATIONALE_SHORT_LENGTH,
  );

  return {
    title: text(o['title']) || fallbackTitle(daysPerWeek, goal),
    goal_label: goalLabel,
    sport_label: sportLabel,
    days_per_week: daysPerWeek,
    est_session_minutes: positiveInt(o['est_session_minutes']) ?? medianDayMinutes(days),
    rationale_short: rationaleShort,
    rationale_full: rationaleFull,
    accommodations: normalizeAccommodations(o['accommodations'], days),
    days,
  };
}

/* ------------------------------------------------------------------ days */

function normalizeDay(raw: unknown, index: number): WorkoutPlanDay | null {
  if (!isRecord(raw)) return null;

  const exercises = Array.isArray(raw['exercises'])
    ? raw['exercises'].map(normalizeExercise).filter((e): e is WorkoutPlanExercise => e !== null)
    : [];

  // Legacy: `day_label` held "Day 1 — Push" and `focus` held the free-text
  // muscle list. New shape splits those into `title` and `subtitle`.
  const legacyLabel = text(raw['day_label']);
  const rawFocus = raw['focus'];
  const legacyFocusText = typeof rawFocus === 'string' ? rawFocus.trim() : '';

  const title = text(raw['title']) || stripDayPrefix(legacyLabel) || `Day ${index + 1}`;
  const focus = normalizeFocus(rawFocus, `${legacyLabel} ${legacyFocusText} ${title}`);
  const subtitle = text(raw['subtitle']) || legacyFocusText || WORKOUT_PLAN_FOCUS_LABELS[focus];

  return {
    day: positiveInt(raw['day']) ?? index + 1,
    title,
    subtitle,
    focus,
    est_minutes: positiveInt(raw['est_minutes']),
    exercises,
  };
}

/**
 * `focus` must land on one of the six enum values. A recognised string wins; a
 * novel one is inferred from surrounding text; anything else falls back to
 * `full`, per the spec — a mis-tinted day is survivable, an uncoloured one is not.
 */
function normalizeFocus(raw: unknown, inferenceText: string): WorkoutPlanFocus {
  if (typeof raw === 'string') {
    const candidate = raw.trim().toLowerCase();
    const exact = WORKOUT_PLAN_FOCUSES.find((f) => f === candidate);
    if (exact) return exact;
  }
  const haystack = `${typeof raw === 'string' ? raw : ''} ${inferenceText}`.toLowerCase();
  for (const [focus, keywords] of FOCUS_KEYWORDS) {
    if (keywords.some((k) => haystack.includes(k))) return focus;
  }
  return 'full';
}

/** "Day 1 — Push" → "Push". Leaves a label that is only a title untouched. */
function stripDayPrefix(label: string): string {
  const stripped = label.replace(/^\s*day\s*\d+\s*[—–:-]\s*/i, '').trim();
  return stripped || label;
}

/* -------------------------------------------------------------- exercises */

function normalizeExercise(raw: unknown): WorkoutPlanExercise | null {
  if (!isRecord(raw)) return null;

  const name = text(raw['name']);
  // No ground-truth transcript keeps the model honest here, so reject anything
  // that is not shaped like an exercise name rather than rendering it.
  if (!name || name.length > MAX_EXERCISE_NAME_LENGTH) return null;

  // Spec: sets must be a positive integer, otherwise drop the exercise. A row
  // reading "— × 10-12" is worse than no row.
  const sets = positiveInt(raw['sets']);
  if (sets === null) return null;

  const note = text(raw['note']);

  return {
    name,
    sets,
    rep_range: enDash(text(raw['rep_range']) || text(raw['reps'])) || null,
    start_load: text(raw['start_load']) || null,
    note: note || null,
    note_type: note ? normalizeNoteType(raw['note_type'], note) : null,
  };
}

/**
 * A note with no usable type still deserves a block — it just renders as a
 * neutral tip rather than a rose caution. Guessing `caution` from the text is
 * only for legacy rows, which had no type field at all.
 */
function normalizeNoteType(raw: unknown, note: string): WorkoutPlanNoteType {
  const candidate = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (candidate === 'caution' || candidate === 'tip') return candidate;
  return /\b(shoulder|knee|back|elbow|hip|wrist|ankle|pain|discomfort|flare|stop if|avoid|careful)\b/i.test(note)
    ? 'caution'
    : 'tip';
}

/** With mono numerals a hyphen in "10-12" reads as a minus sign. */
function enDash(value: string): string {
  return value.replace(/(\d)\s*-\s*(\d)/g, '$1–$2');
}

/* ---------------------------------------------------------- accommodations */

function normalizeAccommodations(raw: unknown, days: WorkoutPlanDay[]): WorkoutPlanAccommodation[] {
  if (!Array.isArray(raw)) return [];
  const cautionCount = days.reduce(
    (n, d) => n + d.exercises.filter((e) => e.note_type === 'caution').length,
    0,
  );
  return raw
    .map((entry): WorkoutPlanAccommodation | null => {
      if (!isRecord(entry)) return null;
      const reason = text(entry['reason']);
      if (!reason) return null;
      // Model counts drift from what actually got a note; the notes are the
      // thing the copy points the user at, so they win.
      return { reason, affected_count: positiveInt(entry['affected_count']) ?? cautionCount };
    })
    .filter((a): a is WorkoutPlanAccommodation => a !== null);
}

/* ---------------------------------------------------------------- helpers */

function fallbackTitle(daysPerWeek: number, goal: GoalType | null): string {
  const suffix = goal ? GOAL_TITLE_WORD[goal] : 'Training Plan';
  return `${daysPerWeek}-Day ${suffix}`;
}

/** Typical session length across the plan, for a hero chip when none was given. */
function medianDayMinutes(days: WorkoutPlanDay[]): number | null {
  const values = days.map((d) => d.est_minutes).filter((m): m is number => m !== null).sort((a, b) => a - b);
  if (values.length === 0) return null;
  return values[Math.floor(values.length / 2)];
}

/** First one or two sentences of a long rationale, for the collapsed state. */
function firstSentences(full: string): string {
  if (!full) return '';
  const sentences = full.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return full;
  return sentences.slice(0, 2).join(' ').trim();
}

function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).replace(/\s+$/, '')}…`;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
