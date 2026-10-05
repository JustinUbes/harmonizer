import { semitonesToRate } from './HarmonyIntervals';
import { decodeWav, encodeWav } from './Wav';

export type PlaybackMode = 'melody' | 'mix' | 'harmony';

export const PLAYBACK_MODES: ReadonlyArray<{ mode: PlaybackMode; label: string }> = [
  { mode: 'melody', label: 'Melody' },
  { mode: 'mix', label: 'Melody + Harmony' },
  { mode: 'harmony', label: 'Harmony Only' },
];

const FRAME_SECONDS = 0.03;
const SEEK_SECONDS = 0.008;
const COARSE_SEEK_STEP = 4;
const CORRELATION_STRIDE = 4;
const HARMONY_GAIN = 0.8;

/**
 * Time-stretch `samples` by `factor` without changing pitch using WSOLA
 * (waveform-similarity overlap-add): each Hann-windowed frame is taken from
 * the position near its nominal analysis point whose waveform best continues
 * the previously copied frame, which keeps phase coherent between frames.
 */
function timeStretch(samples: Float32Array, sampleRate: number, factor: number): Float32Array {
  const length = samples.length;
  const synthesisHop = Math.max(32, Math.round((sampleRate * FRAME_SECONDS) / 2));
  const frameSize = synthesisHop * 2;
  const analysisHop = synthesisHop / factor;
  const seekRange = Math.max(4, Math.round(sampleRate * SEEK_SECONDS));
  const outputLength = Math.ceil(length * factor);
  const output = new Float32Array(outputLength + frameSize);

  const window = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    // Periodic Hann window: overlapping copies at 50% hop sum to exactly 1.
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / frameSize);
  }

  const sampleAt = (index: number) => (index >= 0 && index < length ? samples[index] : 0);

  const correlation = (candidate: number, target: number) => {
    let sum = 0;
    if (candidate >= 0 && target >= 0 && candidate + synthesisHop <= length && target + synthesisHop <= length) {
      for (let i = 0; i < synthesisHop; i += CORRELATION_STRIDE) {
        sum += samples[candidate + i] * samples[target + i];
      }
      return sum;
    }
    for (let i = 0; i < synthesisHop; i += CORRELATION_STRIDE) {
      sum += sampleAt(candidate + i) * sampleAt(target + i);
    }
    return sum;
  };

  let previousPosition = 0;
  for (let frame = 0; frame * synthesisHop < outputLength; frame++) {
    let position = 0;
    if (frame > 0) {
      const nominal = Math.round(frame * analysisHop);
      const naturalContinuation = previousPosition + synthesisHop;
      const minOffset = Math.max(-seekRange, -nominal);
      let bestOffset = 0;
      let bestScore = -Infinity;
      for (let offset = minOffset; offset <= seekRange; offset += COARSE_SEEK_STEP) {
        const score = correlation(nominal + offset, naturalContinuation);
        if (score > bestScore) {
          bestScore = score;
          bestOffset = offset;
        }
      }
      const coarseOffset = bestOffset;
      for (let offset = coarseOffset - COARSE_SEEK_STEP + 1; offset < coarseOffset + COARSE_SEEK_STEP; offset++) {
        if (offset < minOffset || offset > seekRange || offset === coarseOffset) continue;
        const score = correlation(nominal + offset, naturalContinuation);
        if (score > bestScore) {
          bestScore = score;
          bestOffset = offset;
        }
      }
      position = nominal + bestOffset;
    }

    const outputStart = frame * synthesisHop;
    for (let i = 0; i < frameSize; i++) {
      output[outputStart + i] += window[i] * sampleAt(position + i);
    }
    previousPosition = position;
  }

  // The first half-frame only receives one rising window; restore its gain.
  for (let i = 0; i < synthesisHop && i < outputLength; i++) {
    if (window[i] > 1e-3) {
      output[i] /= window[i];
    }
  }

  return output.subarray(0, outputLength);
}

/**
 * Shift the pitch of `samples` by `semitones` while preserving duration:
 * time-stretch by the transposition ratio, then resample back to the
 * original length so the harmony stays locked to the melody's timing.
 */
export function pitchShift(samples: Float32Array, sampleRate: number, semitones: number): Float32Array {
  const ratio = semitonesToRate(semitones);
  const length = samples.length;
  if (ratio === 1 || length === 0) {
    return samples.slice();
  }

  const stretched = timeStretch(samples, sampleRate, ratio);
  const output = new Float32Array(length);
  const lastIndex = stretched.length - 1;
  for (let i = 0; i < length; i++) {
    const source = Math.min(i * ratio, lastIndex);
    const index = Math.floor(source);
    const frac = source - index;
    const next = index < lastIndex ? stretched[index + 1] : stretched[index];
    output[i] = stretched[index] * (1 - frac) + next * frac;
  }
  return output;
}

/** Render the harmony voice alone, or mixed with the original melody. */
export function renderHarmony(
  melody: Float32Array,
  sampleRate: number,
  semitones: number,
  mode: Exclude<PlaybackMode, 'melody'>
): Float32Array {
  const harmony = pitchShift(melody, sampleRate, semitones);
  if (mode === 'harmony') {
    return harmony;
  }

  const mixed = new Float32Array(melody.length);
  let peak = 0;
  for (let i = 0; i < melody.length; i++) {
    mixed[i] = melody[i] + harmony[i] * HARMONY_GAIN;
    peak = Math.max(peak, Math.abs(mixed[i]));
  }
  if (peak > 1) {
    for (let i = 0; i < mixed.length; i++) {
      mixed[i] /= peak;
    }
  }
  return mixed;
}

/** Decode a 16-bit PCM WAV recording, render the requested harmony mode, and re-encode it. */
export function renderHarmonyWav(
  wavBytes: Uint8Array,
  semitones: number,
  mode: Exclude<PlaybackMode, 'melody'>
): Uint8Array {
  const { samples, sampleRate } = decodeWav(wavBytes);
  return encodeWav(renderHarmony(samples, sampleRate, semitones, mode), sampleRate);
}

/** Harmony can only be rendered on-device from PCM WAV recordings with a stored interval. */
export function canRenderHarmony(recording: { uri: string; harmonySemitones?: number }): boolean {
  return typeof recording.harmonySemitones === 'number' && /\.wav$/i.test(recording.uri);
}
