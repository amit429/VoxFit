import { TestBed } from '@angular/core/testing';
import { BadgeService } from '@/app/services/badge.service';

describe('BadgeService', () => {
  let service: BadgeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BadgeService);
  });

  const zero = { streakDays: 0, workouts: 0, prs: 0 };

  it('earns nothing at zero', () => {
    expect(service.evaluate(zero).some((b) => b.earned)).toBe(false);
  });

  it('earns a badge exactly at its threshold, not one below', () => {
    const below = service.evaluate({ ...zero, prs: 9 });
    const at = service.evaluate({ ...zero, prs: 10 });

    expect(below.find((b) => b.key === 'pr_10')?.earned).toBe(false);
    expect(at.find((b) => b.key === 'pr_10')?.earned).toBe(true);
  });

  it('earns every lower tier once a high metric is reached', () => {
    const earned = service.evaluate({ ...zero, streakDays: 30 }).filter((b) => b.earned);

    expect(earned.map((b) => b.key)).toEqual(['streak_3', 'streak_7', 'streak_14', 'streak_30']);
  });

  it('keeps metrics independent — a long streak earns no PR badges', () => {
    const earned = service.evaluate({ ...zero, streakDays: 100 }).filter((b) => b.earned);

    expect(earned.every((b) => b.key.startsWith('streak_'))).toBe(true);
  });

  it('returns the full catalogue regardless of what is earned, so locked tiles still render', () => {
    expect(service.evaluate(zero).length).toBe(service.evaluate({ streakDays: 999, workouts: 999, prs: 999 }).length);
  });
});
