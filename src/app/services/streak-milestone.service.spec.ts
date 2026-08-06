import { TestBed } from '@angular/core/testing';
import { StreakMilestoneService } from '@/app/services/streak-milestone.service';

const STORAGE_KEY = 'voxfit.streak.celebrated';

describe('StreakMilestoneService', () => {
  let service: StreakMilestoneService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({});
    service = TestBed.inject(StreakMilestoneService);
  });

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('returns nothing below the first milestone', () => {
    expect(service.pendingMilestone(2)).toBeNull();
  });

  it('returns the milestone exactly when reached', () => {
    expect(service.pendingMilestone(3)).toBe(3);
  });

  it('returns only the highest milestone reached, not a backlog', () => {
    /* A user returning after a long absence should see one celebration. */
    expect(service.pendingMilestone(45)).toBe(30);
  });

  it('does not re-fire a milestone once celebrated', () => {
    service.markCelebrated(14);

    expect(service.pendingMilestone(14)).toBeNull();
  });

  it('still fires the next milestone after an earlier one was celebrated', () => {
    service.markCelebrated(14);

    expect(service.pendingMilestone(30)).toBe(30);
  });

  it('survives corrupt storage rather than throwing', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');

    expect(() => service.pendingMilestone(7)).not.toThrow();
    expect(service.pendingMilestone(7)).toBe(7);
  });

  it('ignores non-numeric entries left in storage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['7', null, 7]));

    expect(service.pendingMilestone(7)).toBeNull();
  });
});
