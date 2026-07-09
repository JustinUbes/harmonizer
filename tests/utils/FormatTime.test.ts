import { formatTime } from '../../utils/FormatTime';

describe('formatTime', () => {
  it('formats zero milliseconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats less than a minute correctly', () => {
    expect(formatTime(5000)).toBe('0:05');
    expect(formatTime(9000)).toBe('0:09');
    expect(formatTime(10000)).toBe('0:10');
    expect(formatTime(59000)).toBe('0:59');
  });

  it('formats exactly one minute', () => {
    expect(formatTime(60000)).toBe('1:00');
  });

  it('formats minutes and seconds correctly', () => {
    expect(formatTime(90000)).toBe('1:30');
    expect(formatTime(125000)).toBe('2:05');
    expect(formatTime(3600000)).toBe('60:00');
  });

  it('floors milliseconds rather than rounding', () => {
    expect(formatTime(1999)).toBe('0:01');
  });
});
