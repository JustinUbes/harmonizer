import {
  DEFAULT_SAMPLE_RATE,
  FIXTURE_FREQS,
  generateSineWave,
  generateWavBuffer,
} from '../../utils/AudioFixtures';

// ---------------------------------------------------------------------------
// Helpers used only inside this test file
// ---------------------------------------------------------------------------

/**
 * Estimate the dominant frequency of a sine wave using zero-crossing analysis.
 *
 * The approach:
 *   1. Find all indices where the signal crosses zero in the positive direction
 *      (i.e., the sample goes from negative to positive).
 *   2. Compute the average distance (in samples) between consecutive crossings.
 *   3. One full period = one positive zero-crossing to the next, so
 *      estimatedFrequency = sampleRate / averagePeriodInSamples.
 *
 * This gives a clean result for a pure sine wave without any FFT library.
 */
function estimateDominantFrequency(
  samples: Float32Array,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): number {
  const crossings: number[] = [];

  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1] < 0 && samples[i] >= 0) {
      // Linear interpolation for sub-sample precision
      const fraction = -samples[i - 1] / (samples[i] - samples[i - 1]);
      crossings.push(i - 1 + fraction);
    }
  }

  if (crossings.length < 2) {
    throw new Error('Not enough zero-crossings to estimate frequency');
  }

  let totalPeriod = 0;
  for (let i = 1; i < crossings.length; i++) {
    totalPeriod += crossings[i] - crossings[i - 1];
  }
  const avgPeriodSamples = totalPeriod / (crossings.length - 1);

  return sampleRate / avgPeriodSamples;
}

/** Read a 4-byte ASCII string from a Buffer at the given offset. */
function readFourCC(buf: Buffer, offset: number): string {
  return buf.subarray(offset, offset + 4).toString('ascii');
}

// ---------------------------------------------------------------------------
// generateSineWave
// ---------------------------------------------------------------------------

describe('generateSineWave', () => {
  it('returns a Float32Array with the correct number of samples', () => {
    const sampleRate = 44100;
    const durationSec = 0.5;
    const wave = generateSineWave(440, durationSec, sampleRate);

    expect(wave).toBeInstanceOf(Float32Array);
    expect(wave.length).toBe(Math.round(sampleRate * durationSec));
  });

  it('uses DEFAULT_SAMPLE_RATE when sampleRate is omitted', () => {
    const durationSec = 0.25;
    const wave = generateSineWave(440, durationSec);
    expect(wave.length).toBe(Math.round(DEFAULT_SAMPLE_RATE * durationSec));
  });

  it('keeps all samples within [-1, 1]', () => {
    const wave = generateSineWave(440, 0.5);
    for (const sample of wave) {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  it('starts near zero (sine wave begins at the origin)', () => {
    const wave = generateSineWave(440, 0.5);
    // sin(0) = 0, so the first sample should be exactly 0
    expect(wave[0]).toBeCloseTo(0, 10);
  });

  describe('dominant frequency estimation', () => {
    it.each([
      ['A4', FIXTURE_FREQS['A4']],
      ['C5', FIXTURE_FREQS['C5']],
      ['G4', FIXTURE_FREQS['G4']],
    ])('produces a signal whose dominant frequency is close to %s (%d Hz)', (_name, hz) => {
      // Use 1 s so we have many zero-crossings for a stable estimate
      const wave = generateSineWave(hz, 1.0);
      const estimated = estimateDominantFrequency(wave);

      // Allow ±0.5 Hz tolerance — zero-crossing analysis is very accurate for
      // pure sine waves at these frequencies and this sample rate.
      expect(estimated).toBeCloseTo(hz, 0); // within ±0.5 Hz (toBeCloseTo precision 0)
    });

    it('correctly distinguishes A4 (440 Hz) from G4 (392 Hz)', () => {
      const a4 = estimateDominantFrequency(generateSineWave(FIXTURE_FREQS['A4'], 1.0));
      const g4 = estimateDominantFrequency(generateSineWave(FIXTURE_FREQS['G4'], 1.0));
      // The difference must be clearly detectable (should be ~48 Hz apart)
      expect(Math.abs(a4 - g4)).toBeGreaterThan(40);
    });
  });

  describe('input validation', () => {
    it('throws on negative frequencyHz', () => {
      expect(() => generateSineWave(-1, 0.5)).toThrow(RangeError);
    });

    it('throws on zero frequencyHz', () => {
      expect(() => generateSineWave(0, 0.5)).toThrow(RangeError);
    });

    it('throws on NaN frequencyHz', () => {
      expect(() => generateSineWave(NaN, 0.5)).toThrow(RangeError);
    });

    it('throws on Infinity frequencyHz', () => {
      expect(() => generateSineWave(Infinity, 0.5)).toThrow(RangeError);
    });

    it('throws on zero durationSec', () => {
      expect(() => generateSineWave(440, 0)).toThrow(RangeError);
    });

    it('throws on negative durationSec', () => {
      expect(() => generateSineWave(440, -1)).toThrow(RangeError);
    });

    it('throws on NaN durationSec', () => {
      expect(() => generateSineWave(440, NaN)).toThrow(RangeError);
    });

    it('throws on zero sampleRate', () => {
      expect(() => generateSineWave(440, 0.5, 0)).toThrow(RangeError);
    });

    it('throws on negative sampleRate', () => {
      expect(() => generateSineWave(440, 0.5, -44100)).toThrow(RangeError);
    });
  });
});

// ---------------------------------------------------------------------------
// generateWavBuffer
// ---------------------------------------------------------------------------

describe('generateWavBuffer', () => {
  const HZ = 440;
  const DURATION = 0.5;
  const SR = 44100;

  let buf: Buffer;

  beforeAll(() => {
    buf = generateWavBuffer(HZ, DURATION, SR);
  });

  it('returns a Buffer instance', () => {
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it('starts with RIFF magic bytes', () => {
    expect(readFourCC(buf, 0)).toBe('RIFF');
  });

  it('has WAVE form type', () => {
    expect(readFourCC(buf, 8)).toBe('WAVE');
  });

  it('has a fmt  sub-chunk marker at offset 12', () => {
    expect(readFourCC(buf, 12)).toBe('fmt ');
  });

  it('specifies PCM audio format (0x0001)', () => {
    expect(buf.readUInt16LE(20)).toBe(1);
  });

  it('specifies 1 channel (mono)', () => {
    expect(buf.readUInt16LE(22)).toBe(1);
  });

  it('encodes the correct sample rate', () => {
    expect(buf.readUInt32LE(24)).toBe(SR);
  });

  it('encodes the correct byte rate (sampleRate × channels × bytesPerSample)', () => {
    expect(buf.readUInt32LE(28)).toBe(SR * 1 * 2);
  });

  it('encodes 16-bit depth', () => {
    expect(buf.readUInt16LE(34)).toBe(16);
  });

  it('has a data sub-chunk marker at offset 36', () => {
    expect(readFourCC(buf, 36)).toBe('data');
  });

  it('encodes the correct PCM data size in the data chunk', () => {
    const numSamples = Math.round(SR * DURATION);
    const expectedDataBytes = numSamples * 2; // 16-bit = 2 bytes per sample
    expect(buf.readUInt32LE(40)).toBe(expectedDataBytes);
  });

  it('has the correct total buffer length (44-byte header + PCM data)', () => {
    const numSamples = Math.round(SR * DURATION);
    const expectedTotal = 44 + numSamples * 2;
    expect(buf.length).toBe(expectedTotal);
  });

  it('encodes a consistent chunkSize in the RIFF header', () => {
    // chunkSize = fileSize − 8 (the 4 'RIFF' bytes + 4 chunkSize bytes themselves)
    const expectedChunkSize = buf.length - 8;
    expect(buf.readUInt32LE(4)).toBe(expectedChunkSize);
  });

  it('rejects invalid inputs the same way generateSineWave does', () => {
    expect(() => generateWavBuffer(-1, 0.5)).toThrow(RangeError);
    expect(() => generateWavBuffer(440, 0)).toThrow(RangeError);
    expect(() => generateWavBuffer(440, 0.5, -1)).toThrow(RangeError);
  });

  it('uses DEFAULT_SAMPLE_RATE when sampleRate is omitted', () => {
    const defaultBuf = generateWavBuffer(HZ, DURATION);
    const numSamples = Math.round(DEFAULT_SAMPLE_RATE * DURATION);
    expect(defaultBuf.length).toBe(44 + numSamples * 2);
    expect(defaultBuf.readUInt32LE(24)).toBe(DEFAULT_SAMPLE_RATE);
  });
});

// ---------------------------------------------------------------------------
// FIXTURE_FREQS
// ---------------------------------------------------------------------------

describe('FIXTURE_FREQS', () => {
  it('contains at least A4, C5, and G4', () => {
    expect(FIXTURE_FREQS).toHaveProperty('A4');
    expect(FIXTURE_FREQS).toHaveProperty('C5');
    expect(FIXTURE_FREQS).toHaveProperty('G4');
  });

  it('maps every entry to a positive finite frequency', () => {
    for (const [name, hz] of Object.entries(FIXTURE_FREQS)) {
      expect(typeof hz).toBe('number');
      expect(Number.isFinite(hz)).toBe(true);
      expect(hz).toBeGreaterThan(0);
      // Sanity-check: all values should be within the audible range
      expect(hz).toBeGreaterThanOrEqual(20);
      expect(hz).toBeLessThanOrEqual(20000);
      // Ensure the name itself is non-empty
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('A4 is the standard concert-pitch A (440 Hz)', () => {
    expect(FIXTURE_FREQS['A4']).toBe(440);
  });

  it('C5 is approximately 523.25 Hz', () => {
    expect(FIXTURE_FREQS['C5']).toBeCloseTo(523.25, 2);
  });

  it('G4 is 392 Hz', () => {
    expect(FIXTURE_FREQS['G4']).toBe(392);
  });

  it('each fixture frequency generates a valid sine wave without throwing', () => {
    for (const hz of Object.values(FIXTURE_FREQS)) {
      expect(() => generateSineWave(hz, 0.1)).not.toThrow();
    }
  });

  it('each fixture frequency generates a valid WAV buffer without throwing', () => {
    for (const hz of Object.values(FIXTURE_FREQS)) {
      expect(() => generateWavBuffer(hz, 0.1)).not.toThrow();
    }
  });
});
