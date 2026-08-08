import { TestBed } from '@angular/core/testing';
import { BadgeService } from '@/app/services/badge.service';
import type { BadgeProgressRow } from '@/app/models';

/**
 * Threshold logic is no longer tested here — it moved into the database
 * (`badge_definitions`, migration 0006), which is what makes a badge
 * un-fakeable from the client. What this service still owns is mapping the
 * server's rows onto shelf tiles, so that is what these cover.
 */
describe('BadgeService', () => {
  let service: BadgeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BadgeService);
  });

  function row(overrides: Partial<BadgeProgressRow> = {}): BadgeProgressRow {
    return { badge_key: 'pr_1', metric: 'prs', threshold: 1, earned_at: null, ...overrides };
  }

  it('returns an empty shelf for no rows', () => {
    expect(service.toShelf([])).toEqual([]);
  });

  it('marks a badge earned only when it has an earned_at', () => {
    const shelf = service.toShelf([
      row({ badge_key: 'pr_1', earned_at: '2026-08-01T10:00:00Z' }),
      row({ badge_key: 'pr_10', earned_at: null }),
    ]);

    expect(shelf[0]?.earned).toBe(true);
    expect(shelf[1]?.earned).toBe(false);
  });

  it('attaches presentation for a known key', () => {
    const [tile] = service.toShelf([row({ badge_key: 'streak_14', metric: 'streak', threshold: 14 })]);

    expect(tile?.label).toBe('14 DAYS');
    expect(tile?.tone).toBe('apricot');
  });

  it('tones by what the badge measures, not by rarity', () => {
    const shelf = service.toShelf([
      row({ badge_key: 'streak_7', metric: 'streak' }),
      row({ badge_key: 'pr_10', metric: 'prs' }),
      row({ badge_key: 'logs_50', metric: 'workouts' }),
    ]);

    expect(shelf.map((b) => b.tone)).toEqual(['apricot', 'jade', 'brand']);
  });

  /*
   * A badge added server-side must still render — otherwise seeding a new
   * definition silently drops a tile until the app ships again.
   */
  it('falls back to neutral presentation for an unknown key', () => {
    const [tile] = service.toShelf([row({ badge_key: 'brand_new_badge' })]);

    expect(tile).toBeTruthy();
    expect(tile?.tone).toBe('slate');
  });

  it('preserves server ordering', () => {
    const keys = ['streak_3', 'pr_1', 'logs_10'];
    const shelf = service.toShelf(keys.map((badge_key) => row({ badge_key })));

    expect(shelf.map((b) => b.key)).toEqual(keys);
  });
});
