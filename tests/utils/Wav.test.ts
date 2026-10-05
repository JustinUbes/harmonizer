import { generateSineWave, generateWavBuffer } from '../../utils/AudioFixtures';
import { decodeWav, encodeWav } from '../../utils/Wav';

function withChunkBeforeData(wav: Uint8Array, chunkId: string, bodySize: number): Uint8Array {
  // Insert an extra chunk between `fmt ` (ends at byte 36) and `data`, as iOS does with `FLLR`.
  const extra = new Uint8Array(8 + bodySize);
  for (let i = 0; i < 4; i++) extra[i] = chunkId.charCodeAt(i);
  new DataView(extra.buffer).setUint32(4, bodySize, true);
  const result = new Uint8Array(wav.length + extra.length);
  result.set(wav.subarray(0, 36), 0);
  result.set(extra, 36);
  result.set(wav.subarray(36), 36 + extra.length);
  return result;
}

describe('Wav', () => {
  it('decodes a 16-bit mono fixture WAV', () => {
    const decoded = decodeWav(new Uint8Array(generateWavBuffer(440, 0.1)));
    const expected = generateSineWave(440, 0.1);

    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.samples).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i += 97) {
      expect(decoded.samples[i]).toBeCloseTo(expected[i], 3);
    }
  });

  it('round-trips samples through encodeWav and decodeWav', () => {
    const samples = Float32Array.from([0, 0.5, -0.5, 0.999, -0.999]);
    const decoded = decodeWav(encodeWav(samples, 22050));

    expect(decoded.sampleRate).toBe(22050);
    expect(Array.from(decoded.samples)).toEqual(
      Array.from(samples).map((value) => expect.closeTo(value, 3))
    );
  });

  it('clamps out-of-range samples when encoding', () => {
    const decoded = decodeWav(encodeWav(Float32Array.from([2, -2]), 44100));

    expect(decoded.samples[0]).toBeCloseTo(1, 3);
    expect(decoded.samples[1]).toBeCloseTo(-1, 3);
  });

  it('skips unknown chunks such as the iOS FLLR padding chunk', () => {
    const wav = withChunkBeforeData(encodeWav(Float32Array.from([0.25, -0.25]), 44100), 'FLLR', 6);
    const decoded = decodeWav(wav);

    expect(decoded.samples).toHaveLength(2);
    expect(decoded.samples[0]).toBeCloseTo(0.25, 3);
  });

  it('down-mixes stereo audio to mono', () => {
    const wav = encodeWav(Float32Array.from([0.5, 0.1]), 44100);
    const view = new DataView(wav.buffer);
    // Reinterpret the two mono samples as one stereo frame.
    view.setUint16(22, 2, true);
    view.setUint16(32, 4, true);

    const decoded = decodeWav(wav);
    expect(decoded.samples).toHaveLength(1);
    expect(decoded.samples[0]).toBeCloseTo(0.3, 3);
  });

  it('rejects files that are not 16-bit PCM WAV', () => {
    expect(() => decodeWav(new Uint8Array(16))).toThrow('Not a RIFF/WAVE file');

    const eightBit = encodeWav(Float32Array.from([0]), 44100);
    new DataView(eightBit.buffer).setUint16(34, 8, true);
    expect(() => decodeWav(eightBit)).toThrow('Only 16-bit PCM WAV files are supported');
  });
});
