import { TestBed } from '@angular/core/testing';
import type { CheckinGenerateResult, ProgressReviewRow, PlanNudgeRow } from '@/app/models';
import { AuthService } from '@/app/services/auth.service';
import { SupabaseService } from '@/app/services/supabase.service';
import { GeminiCheckinService } from '@/app/services/gemini-checkin.service';
import { ProgressCoachService } from './progress-coach.service';

const mockReview: ProgressReviewRow = {
  id: 'review-1',
  user_id: 'user-1',
  created_at: '2026-08-01T00:00:00.000Z',
  period_start: '2026-07-25',
  period_end: '2026-08-01',
  generated_for_week: '2026-W31',
  headline_tone: 'positive',
  acknowledged_at: null,
  review: {
    highlights: ['Hit every planned session this week.'],
    trends: ['Volume trending up.'],
    recurringNotes: [],
    suggestions: ['Keep the pace.'],
  },
  stats_snapshot: {
    goal: 'bulk',
    sportType: 'gym',
    targetCalories: 2600,
    targetProteinG: 170,
    windowWeeks: 8,
    sessionsInWindow: 12,
    avgSessionsPerWeek: 1.5,
    currentStreakDays: 3,
    weeklyVolumeKg: [1000, 1200],
    prCount: 1,
    topExercises: [],
    recentFlags: [],
  },
};

const mockNudge: PlanNudgeRow = {
  id: 'nudge-1',
  user_id: 'user-1',
  plan_id: 'plan-1',
  created_at: '2026-08-01T00:00:00.000Z',
  period_start: '2026-07-25',
  period_end: '2026-08-01',
  generated_for_week: '2026-W31',
  suggests_refresh: false,
  planned_sessions: 4,
  completed_sessions: 4,
  acknowledged_at: null,
  nudge: {
    executionNotes: ['Great adherence.'],
    focusThisWeek: ['Push a bit harder on squats.'],
    driftReason: '',
  },
};

/** Minimal chainable mock for `.from(table).update(patch).eq(col, val)` resolving to `{ error }`. */
function createSupabaseMock(response: { error: { message: string } | null } = { error: null }) {
  const eqSpy = jasmine.createSpy('eq').and.returnValue(Promise.resolve(response));
  const updateSpy = jasmine.createSpy('update').and.returnValue({ eq: eqSpy });
  const fromSpy = jasmine.createSpy('from').and.returnValue({ update: updateSpy });
  return { client: { from: fromSpy } } as unknown as SupabaseService;
}

function createAuthMock(uid: string | null = 'user-1'): AuthService {
  return { user: () => (uid ? { id: uid } : null) } as unknown as AuthService;
}

describe('ProgressCoachService', () => {
  it('acknowledgeReview sets acknowledged_at on latestReview when ids match', async () => {
    const supabaseMock = createSupabaseMock({ error: null });
    TestBed.configureTestingModule({
      providers: [
        ProgressCoachService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthService, useValue: createAuthMock() },
        { provide: GeminiCheckinService, useValue: { generate: jasmine.createSpy('generate') } },
      ],
    });
    const service = TestBed.inject(ProgressCoachService);
    service.latestReview.set({ ...mockReview, acknowledged_at: null });

    await service.acknowledgeReview('review-1');

    expect(service.latestReview()?.acknowledged_at).not.toBeNull();
    expect(supabaseMock.client.from).toHaveBeenCalledWith('progress_reviews');
  });

  it('acknowledgeReview leaves latestReview untouched when ids do not match', async () => {
    const supabaseMock = createSupabaseMock({ error: null });
    TestBed.configureTestingModule({
      providers: [
        ProgressCoachService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthService, useValue: createAuthMock() },
        { provide: GeminiCheckinService, useValue: { generate: jasmine.createSpy('generate') } },
      ],
    });
    const service = TestBed.inject(ProgressCoachService);
    service.latestReview.set({ ...mockReview, id: 'other-review', acknowledged_at: null });

    await service.acknowledgeReview('review-1');

    expect(service.latestReview()?.acknowledged_at).toBeNull();
  });

  it('generate() populates both latestReview and latestNudge from the gemini result', async () => {
    const result: CheckinGenerateResult = { review: mockReview, nudge: mockNudge };
    const geminiMock = { generate: jasmine.createSpy('generate').and.returnValue(Promise.resolve(result)) };
    TestBed.configureTestingModule({
      providers: [
        ProgressCoachService,
        { provide: SupabaseService, useValue: createSupabaseMock() },
        { provide: AuthService, useValue: createAuthMock() },
        { provide: GeminiCheckinService, useValue: geminiMock },
      ],
    });
    const service = TestBed.inject(ProgressCoachService);

    const returned = await service.generate();

    expect(service.latestReview()).toEqual(mockReview);
    expect(service.latestNudge()).toEqual(mockNudge);
    expect(returned).toEqual(result);
    expect(geminiMock.generate).toHaveBeenCalled();
  });

  it('generate() throws when no user is signed in', async () => {
    TestBed.configureTestingModule({
      providers: [
        ProgressCoachService,
        { provide: SupabaseService, useValue: createSupabaseMock() },
        { provide: AuthService, useValue: createAuthMock(null) },
        { provide: GeminiCheckinService, useValue: { generate: jasmine.createSpy('generate') } },
      ],
    });
    const service = TestBed.inject(ProgressCoachService);

    await expectAsync(service.generate()).toBeRejectedWithError('Not signed in');
  });
});
