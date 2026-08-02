import { planWindowDates } from './workout-plan.service';

describe('planWindowDates', () => {
  it('returns today as start and +28 days as end (YYYY-MM-DD)', () => {
    const { start_date, end_date } = planWindowDates(new Date('2026-08-02T09:00:00'), 28);
    expect(start_date).toBe('2026-08-02');
    expect(end_date).toBe('2026-08-30');
  });
});
