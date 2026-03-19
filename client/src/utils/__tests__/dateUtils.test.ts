import { describe, it, expect } from 'vitest';
import {
  TIME_SLOTS,
  getWeekRange,
  getNextWeek,
  getPrevWeek,
  getQuarter,
  formatDateRange,
} from '../dateUtils';

describe('TIME_SLOTS', () => {
  it('should have exactly 12 time slots', () => {
    expect(TIME_SLOTS).toHaveLength(12);
  });

  it('should start at 09:00 and end at 21:00', () => {
    expect(TIME_SLOTS[0]).toBe('09:00-10:00');
    expect(TIME_SLOTS[11]).toBe('20:00-21:00');
  });

  it('should have consecutive time slots', () => {
    for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
      const endOfCurrent = TIME_SLOTS[i].split('-')[1];
      const startOfNext = TIME_SLOTS[i + 1].split('-')[0];
      expect(endOfCurrent).toBe(startOfNext);
    }
  });
});

describe('getWeekRange', () => {
  it('should return Monday-Sunday for a Wednesday', () => {
    // 2025-01-08 is a Wednesday
    const result = getWeekRange(new Date(2025, 0, 8));
    expect(result.start).toBe('2025-01-06');
    expect(result.end).toBe('2025-01-12');
    expect(result.dates).toEqual([
      '2025-01-06',
      '2025-01-07',
      '2025-01-08',
      '2025-01-09',
      '2025-01-10',
      '2025-01-11',
      '2025-01-12',
    ]);
  });

  it('should return Monday-Sunday for a Monday', () => {
    // 2025-01-06 is a Monday
    const result = getWeekRange(new Date(2025, 0, 6));
    expect(result.start).toBe('2025-01-06');
    expect(result.end).toBe('2025-01-12');
  });

  it('should return same week for a Saturday', () => {
    // 2025-01-11 is a Saturday → same week Mon 2025-01-06
    const result = getWeekRange(new Date(2025, 0, 11));
    expect(result.start).toBe('2025-01-06');
    expect(result.end).toBe('2025-01-12');
  });

  it('should return same week for a Sunday', () => {
    // 2025-01-12 is a Sunday → same week Mon 2025-01-06
    const result = getWeekRange(new Date(2025, 0, 12));
    expect(result.start).toBe('2025-01-06');
    expect(result.end).toBe('2025-01-12');
  });

  it('should always return exactly 7 dates', () => {
    const result = getWeekRange(new Date(2025, 5, 15));
    expect(result.dates).toHaveLength(7);
  });

  it('should handle year boundary (Dec → Jan)', () => {
    // 2024-12-31 is a Tuesday
    const result = getWeekRange(new Date(2024, 11, 31));
    expect(result.start).toBe('2024-12-30');
    expect(result.end).toBe('2025-01-05');
  });
});

describe('getNextWeek / getPrevWeek', () => {
  it('getNextWeek should return Monday + 7 days', () => {
    expect(getNextWeek('2025-01-06')).toBe('2025-01-13');
  });

  it('getPrevWeek should return Monday - 7 days', () => {
    expect(getPrevWeek('2025-01-13')).toBe('2025-01-06');
  });

  it('roundtrip: getNextWeek then getPrevWeek returns original', () => {
    const original = '2025-01-06';
    expect(getPrevWeek(getNextWeek(original))).toBe(original);
  });

  it('roundtrip: getPrevWeek then getNextWeek returns original', () => {
    const original = '2025-03-10';
    expect(getNextWeek(getPrevWeek(original))).toBe(original);
  });

  it('should handle year boundary', () => {
    expect(getNextWeek('2024-12-30')).toBe('2025-01-06');
    expect(getPrevWeek('2025-01-06')).toBe('2024-12-30');
  });
});

describe('getQuarter', () => {
  it('should return Q1 for January', () => {
    expect(getQuarter(new Date(2025, 0, 15))).toBe('2025-Q1');
  });

  it('should return Q1 for March', () => {
    expect(getQuarter(new Date(2025, 2, 31))).toBe('2025-Q1');
  });

  it('should return Q2 for April', () => {
    expect(getQuarter(new Date(2025, 3, 1))).toBe('2025-Q2');
  });

  it('should return Q2 for June', () => {
    expect(getQuarter(new Date(2025, 5, 30))).toBe('2025-Q2');
  });

  it('should return Q3 for July', () => {
    expect(getQuarter(new Date(2025, 6, 1))).toBe('2025-Q3');
  });

  it('should return Q3 for September', () => {
    expect(getQuarter(new Date(2025, 8, 30))).toBe('2025-Q3');
  });

  it('should return Q4 for October', () => {
    expect(getQuarter(new Date(2025, 9, 1))).toBe('2025-Q4');
  });

  it('should return Q4 for December', () => {
    expect(getQuarter(new Date(2025, 11, 31))).toBe('2025-Q4');
  });

  it('should include correct year', () => {
    expect(getQuarter(new Date(2024, 6, 15))).toBe('2024-Q3');
  });
});

describe('formatDateRange', () => {
  it('should format same-year current-year range without year', () => {
    const currentYear = new Date().getFullYear();
    const start = `${currentYear}-01-06`;
    const end = `${currentYear}-01-10`;
    expect(formatDateRange(start, end)).toBe('1月6日 - 1月10日');
  });

  it('should format same-year non-current-year range with year prefix', () => {
    expect(formatDateRange('2020-03-02', '2020-03-06')).toBe(
      '2020年3月2日 - 3月6日'
    );
  });

  it('should format cross-year range with both years', () => {
    expect(formatDateRange('2024-12-30', '2025-01-03')).toBe(
      '2024年12月30日 - 2025年1月3日'
    );
  });
});
