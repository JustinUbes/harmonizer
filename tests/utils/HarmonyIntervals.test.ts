import {
  DEFAULT_HARMONY_INTERVAL,
  getIntervalByLabel,
  HARMONY_INTERVALS,
  semitonesToRate,
} from '../../utils/HarmonyIntervals';

describe('HarmonyIntervals', () => {
  it('exposes all supported intervals in order', () => {
    expect(HARMONY_INTERVALS).toEqual([
      { label: 'Minor 3rd', semitones: 3 },
      { label: 'Major 3rd', semitones: 4 },
      { label: 'Perfect 5th', semitones: 7 },
      { label: 'Octave', semitones: 12 },
    ]);
  });

  it('uses Major 3rd as the default interval', () => {
    expect(DEFAULT_HARMONY_INTERVAL).toEqual({ label: 'Major 3rd', semitones: 4 });
  });

  it('finds intervals by label', () => {
    expect(getIntervalByLabel('Perfect 5th')).toEqual({
      label: 'Perfect 5th',
      semitones: 7,
    });
    expect(getIntervalByLabel('Unknown')).toBeUndefined();
  });

  it('converts semitones to playback rate correctly', () => {
    expect(semitonesToRate(0)).toBeCloseTo(1, 10);
    expect(semitonesToRate(12)).toBeCloseTo(2, 10);
    expect(semitonesToRate(-12)).toBeCloseTo(0.5, 10);
    expect(semitonesToRate(7)).toBeCloseTo(Math.pow(2, 7 / 12), 10);
  });

  it('rejects non-finite semitone values', () => {
    expect(() => semitonesToRate(Number.NaN)).toThrow('semitones must be a finite number');
    expect(() => semitonesToRate(Number.POSITIVE_INFINITY)).toThrow(
      'semitones must be a finite number'
    );
  });

  it('rejects out-of-range semitone values', () => {
    expect(() => semitonesToRate(49)).toThrow('semitones must be between -48 and 48');
    expect(() => semitonesToRate(-49)).toThrow('semitones must be between -48 and 48');
  });

  describe('semitone and playback-rate mapping for each interval', () => {
    it.each([
      ['Minor 3rd', 3, 1.189207115],
      ['Major 3rd', 4, 1.25992105],
      ['Perfect 5th', 7, 1.498307077],
      ['Octave', 12, 2],
    ])('%s maps to %i semitones and a rate of ~%f', (label, semitones, expectedRate) => {
      const interval = getIntervalByLabel(label);

      expect(interval).toBeDefined();
      expect(interval?.semitones).toBe(semitones);
      expect(semitonesToRate(semitones)).toBeCloseTo(expectedRate, 8);
    });

    it('produces strictly increasing rates above unison in interval order', () => {
      const rates = HARMONY_INTERVALS.map((interval) => semitonesToRate(interval.semitones));

      rates.forEach((rate, index) => {
        expect(rate).toBeGreaterThan(index === 0 ? 1 : rates[index - 1]);
      });
    });

    it('has unique labels', () => {
      const labels = HARMONY_INTERVALS.map((interval) => interval.label);

      expect(new Set(labels).size).toBe(labels.length);
    });
  });

  describe('edge inputs', () => {
    it('accepts the inclusive range boundaries', () => {
      expect(semitonesToRate(48)).toBeCloseTo(16, 10);
      expect(semitonesToRate(-48)).toBeCloseTo(1 / 16, 10);
    });

    it('rejects values just outside the range boundaries', () => {
      expect(() => semitonesToRate(48.0001)).toThrow(RangeError);
      expect(() => semitonesToRate(-48.0001)).toThrow(RangeError);
    });

    it('rejects negative infinity as a TypeError', () => {
      expect(() => semitonesToRate(Number.NEGATIVE_INFINITY)).toThrow(TypeError);
    });

    it('treats negative zero as unison', () => {
      expect(semitonesToRate(-0)).toBe(1);
    });

    it('supports downward intervals as the reciprocal of upward intervals', () => {
      HARMONY_INTERVALS.forEach(({ semitones }) => {
        expect(semitonesToRate(-semitones)).toBeCloseTo(1 / semitonesToRate(semitones), 10);
      });
    });

    it('supports fractional semitones (e.g. quarter tones)', () => {
      expect(semitonesToRate(0.5)).toBeCloseTo(Math.pow(2, 1 / 24), 10);
    });

    it('returns undefined for labels that do not match exactly', () => {
      expect(getIntervalByLabel('')).toBeUndefined();
      expect(getIntervalByLabel('major 3rd')).toBeUndefined();
      expect(getIntervalByLabel(' Major 3rd ')).toBeUndefined();
    });
  });
});
