/**
 * AudioFixtures.ts
 *
 * Synthetic audio signal helpers for use in Jest tests.
 *
 * Everything is generated in-memory from pure math — no binary assets are
 * committed to the repository.  All functions are pure and have no side-effects
 * so they work safely in the Node.js Jest environment (no expo-av required).
 */

/** Default sample rate used throughout the app (CD quality). */
export const DEFAULT_SAMPLE_RATE = 44100;

/**
 * A small catalogue of fixture frequencies keyed by friendly name.
 * These match common musical reference pitches used in harmony tests.
 */
export const FIXTURE_FREQS: Readonly<Record<string, number>> = {
  A4: 440,
  C5: 523.25,
  G4: 392,
};

/**
 * Generate a pure sine wave at the requested frequency.
 *
 * @param frequencyHz  Desired frequency in Hz.  Must be positive and finite.
 * @param durationSec  Duration in seconds.  Must be positive and finite.
 * @param sampleRate   Samples per second (default: 44 100).
 * @returns            Float32Array of PCM samples in the range [-1, 1].
 */
export function generateSineWave(
  frequencyHz: number,
  durationSec: number,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): Float32Array {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    throw new RangeError('frequencyHz must be a positive finite number');
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new RangeError('durationSec must be a positive finite number');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError('sampleRate must be a positive finite number');
  }

  const numSamples = Math.round(sampleRate * durationSec);
  const samples = new Float32Array(numSamples);
  const twoPiF = 2 * Math.PI * frequencyHz;

  for (let i = 0; i < numSamples; i++) {
    samples[i] = Math.sin(twoPiF * (i / sampleRate));
  }

  return samples;
}

/**
 * Wrap a generated sine wave in a minimal PCM WAV header (16-bit, mono).
 *
 * The WAV layout is:
 *   RIFF header (12 bytes) → fmt chunk (24 bytes) → data chunk (8 + pcm bytes)
 *
 * @param frequencyHz  Desired frequency in Hz.  Must be positive and finite.
 * @param durationSec  Duration in seconds.  Must be positive and finite.
 * @param sampleRate   Samples per second (default: 44 100).
 * @returns            Node.js Buffer containing a valid WAV file.
 */
export function generateWavBuffer(
  frequencyHz: number,
  durationSec: number,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): Buffer {
  const samples = generateSineWave(frequencyHz, durationSec, sampleRate);
  const numSamples = samples.length;

  const BITS_PER_SAMPLE = 16;
  const NUM_CHANNELS = 1;
  const bytesPerSample = BITS_PER_SAMPLE / 8; // 2
  const byteRate = sampleRate * NUM_CHANNELS * bytesPerSample;
  const blockAlign = NUM_CHANNELS * bytesPerSample;
  const pcmDataSize = numSamples * bytesPerSample;

  // Total WAV file size breakdown:
  //   4  'RIFF'
  //   4  chunkSize  (= 4 + 24 + 8 + pcmDataSize)
  //   4  'WAVE'
  //   4  'fmt '
  //   4  subchunk1Size (= 16 for PCM)
  //  16  fmt body
  //   4  'data'
  //   4  subchunk2Size (= pcmDataSize)
  //   N  PCM samples
  // 44-byte header: 12 (RIFF) + 24 (fmt) + 8 (data header)
  const headerSize = 44;
  const totalSize = headerSize + pcmDataSize;
  const buf = Buffer.alloc(totalSize);

  let offset = 0;

  // RIFF chunk descriptor
  buf.write('RIFF', offset, 'ascii'); offset += 4;
  buf.writeUInt32LE(headerSize - 8 + pcmDataSize, offset); offset += 4; // file size − 8
  buf.write('WAVE', offset, 'ascii'); offset += 4;

  // fmt sub-chunk
  buf.write('fmt ', offset, 'ascii'); offset += 4;
  buf.writeUInt32LE(16, offset); offset += 4;          // subchunk1Size for PCM
  buf.writeUInt16LE(1, offset); offset += 2;           // PCM audio format
  buf.writeUInt16LE(NUM_CHANNELS, offset); offset += 2;
  buf.writeUInt32LE(sampleRate, offset); offset += 4;
  buf.writeUInt32LE(byteRate, offset); offset += 4;
  buf.writeUInt16LE(blockAlign, offset); offset += 2;
  buf.writeUInt16LE(BITS_PER_SAMPLE, offset); offset += 2;

  // data sub-chunk
  buf.write('data', offset, 'ascii'); offset += 4;
  buf.writeUInt32LE(pcmDataSize, offset); offset += 4;

  // Convert Float32 [-1, 1] samples to Int16 and write little-endian
  const INT16_MAX = 32767;
  for (let i = 0; i < numSamples; i++) {
    // Clamp to [-1, 1] before scaling to guard against floating-point drift
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * INT16_MAX), offset);
    offset += 2;
  }

  return buf;
}
