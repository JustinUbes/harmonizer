export const HARMONY_INTERVALS = [
  { label: 'Minor 3rd', semitones: 3 },
  { label: 'Major 3rd', semitones: 4 },
  { label: 'Perfect 5th', semitones: 7 },
  { label: 'Octave', semitones: 12 },
] as const;

export type HarmonyInterval = (typeof HARMONY_INTERVALS)[number];

export const DEFAULT_HARMONY_INTERVAL: HarmonyInterval = HARMONY_INTERVALS[1];

export function getIntervalByLabel(label: string): HarmonyInterval | undefined {
  return HARMONY_INTERVALS.find((interval) => interval.label === label);
}

export function semitonesToRate(semitones: number): number {
  if (!Number.isFinite(semitones)) {
    throw new TypeError('semitones must be a finite number');
  }

  // Bound the value to a realistic range for harmony transposition.
  if (semitones < -48 || semitones > 48) {
    throw new RangeError('semitones must be between -48 and 48');
  }

  return Math.pow(2, semitones / 12);
}
