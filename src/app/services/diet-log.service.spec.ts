import { inferMealType } from './diet-log.service';

function atHour(h: number, m = 0): Date {
  const d = new Date(2026, 0, 1, h, m, 0);
  return d;
}

describe('inferMealType', () => {
  it('classifies the morning band as breakfast', () => {
    expect(inferMealType(atHour(6, 0))).toBe('breakfast');
    expect(inferMealType(atHour(9))).toBe('breakfast');
    expect(inferMealType(atHour(10, 59))).toBe('breakfast');
  });

  it('classifies the midday band as lunch', () => {
    expect(inferMealType(atHour(11, 0))).toBe('lunch');
    expect(inferMealType(atHour(13))).toBe('lunch');
    expect(inferMealType(atHour(14, 59))).toBe('lunch');
  });

  it('classifies the afternoon band as snack', () => {
    expect(inferMealType(atHour(15, 0))).toBe('snack');
    expect(inferMealType(atHour(16, 59))).toBe('snack');
  });

  it('classifies the evening band as dinner', () => {
    expect(inferMealType(atHour(17, 0))).toBe('dinner');
    expect(inferMealType(atHour(19))).toBe('dinner');
    expect(inferMealType(atHour(21, 59))).toBe('dinner');
  });

  it('falls back to snack late at night and before 6am', () => {
    expect(inferMealType(atHour(22, 0))).toBe('snack');
    expect(inferMealType(atHour(23, 59))).toBe('snack');
    expect(inferMealType(atHour(0, 0))).toBe('snack');
    expect(inferMealType(atHour(5, 59))).toBe('snack');
  });
});
