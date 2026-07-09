import { getCurrentDate } from '../../utils/CurrentDate';

describe('getCurrentDate', () => {
  it('returns a non-empty string', () => {
    const result = getCurrentDate();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains the current year', () => {
    const result = getCurrentDate();
    const year = new Date().getFullYear().toString();
    expect(result).toContain(year);
  });

  it('does not contain raw slash-separated date format', () => {
    // Should use locale formatting, not the old DD/MM/YYYY pattern
    const result = getCurrentDate();
    expect(result).not.toMatch(/\d+\/\d+\/\d+/);
  });
});
