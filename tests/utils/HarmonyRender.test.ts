import { DEFAULT_SAMPLE_RATE, generateSineWave, generateWavBuffer } from '../../utils/AudioFixtures';
import { HARMONY_INTERVALS } from '../../utils/HarmonyIntervals';
import {
  canRenderHarmony,
  pitchShift,
  renderHarmony,
  renderHarmonyWav,
} from '../../utils/HarmonyRender';
import { decodeWav } from '../../utils/Wav';

/** Find the strongest frequency (1 Hz resolution) in a quarter-second window from the middle of the signal. */
function dominantFrequency(samples: Float32Array, minHz: number, maxHz: number): number {
  const start = Math.floor(samples.length / 4);
  const windowLength = Math.floor(DEFAULT_SAMPLE_RATE / 4);
  let bestMagnitude = 0;
  let bestFrequency = 0;
  for (let frequency = minHz; frequency <= maxHz; frequency++) {
    let real = 0;
    let imaginary = 0;
    for (let i = 0; i < windowLength; i++) {
      const phase = (2 * Math.PI * frequency * i) / DEFAULT_SAMPLE_RATE;
      real += samples[start + i] * Math.cos(phase);
      imaginary += samples[start + i] * Math.sin(phase);
    }
    const magnitude = real * real + imaginary * imaginary;
    if (magnitude > bestMagnitude) {
      bestMagnitude = magnitude;
      bestFrequency = frequency;
    }
  }
  return bestFrequency;
}

function rms(samples: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (end - start));
}

describe('HarmonyRender', () => {
  const melody = generateSineWave(440, 1);

  it.each(HARMONY_INTERVALS.map((interval) => [interval.label, interval.semitones]))(
    'shifts A4 up a %s without changing duration',
    (_label, semitones) => {
      const shifted = pitchShift(melody, DEFAULT_SAMPLE_RATE, semitones);
      const expectedHz = 440 * Math.pow(2, semitones / 12);

      expect(shifted).toHaveLength(melody.length);
      expect(Math.abs(dominantFrequency(shifted, Math.round(expectedHz) - 40, Math.round(expectedHz) + 40) - expectedHz)).toBeLessThanOrEqual(
        expectedHz * 0.01
      );
    }
  );

  it('shifts pitch downward too', () => {
    const shifted = pitchShift(melody, DEFAULT_SAMPLE_RATE, -12);
    expect(dominantFrequency(shifted, 180, 260)).toBeCloseTo(220, -1);
  });

  it('keeps a steady level so the harmony stays aligned with the melody', () => {
    const shifted = pitchShift(melody, DEFAULT_SAMPLE_RATE, 4);
    expect(rms(shifted, 2000, melody.length - 2000)).toBeCloseTo(rms(melody, 0, melody.length), 1);
  });

  it('returns an unmodified copy for zero semitones', () => {
    const shifted = pitchShift(melody, DEFAULT_SAMPLE_RATE, 0);
    expect(shifted).not.toBe(melody);
    expect(shifted).toEqual(melody);
  });

  it('renders harmony-only audio without the melody', () => {
    const harmony = renderHarmony(melody, DEFAULT_SAMPLE_RATE, 7, 'harmony');
    expect(dominantFrequency(harmony, 620, 700)).toBeCloseTo(659, -1);
  });

  it('mixes melody and harmony without clipping', () => {
    const mixed = renderHarmony(melody, DEFAULT_SAMPLE_RATE, 4, 'mix');
    const peak = mixed.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

    expect(mixed).toHaveLength(melody.length);
    expect(peak).toBeLessThanOrEqual(1);
    expect(dominantFrequency(mixed, 430, 450)).toBe(440);
    expect(dominantFrequency(mixed, 540, 570)).toBe(554);
  });

  it('renders a harmony WAV that keeps the sample rate and length', () => {
    const wav = new Uint8Array(generateWavBuffer(440, 0.5));
    const rendered = decodeWav(renderHarmonyWav(wav, 4, 'harmony'));

    expect(rendered.sampleRate).toBe(DEFAULT_SAMPLE_RATE);
    expect(rendered.samples).toHaveLength(decodeWav(wav).samples.length);
  });

  it('only allows rendering for WAV recordings with a stored interval', () => {
    expect(canRenderHarmony({ uri: 'file:///a.wav', harmonySemitones: 4 })).toBe(true);
    expect(canRenderHarmony({ uri: 'file:///a.WAV', harmonySemitones: 0 })).toBe(true);
    expect(canRenderHarmony({ uri: 'file:///a.m4a', harmonySemitones: 4 })).toBe(false);
    expect(canRenderHarmony({ uri: 'file:///a.wav' })).toBe(false);
  });
});
