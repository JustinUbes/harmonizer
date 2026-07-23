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
});
