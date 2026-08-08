# Test Fixtures

This directory contains documentation and metadata for Harmonizer's audio test fixtures.

## Philosophy

Audio fixtures are generated **in-memory** by `utils/AudioFixtures.ts` rather than committed
as binary files. This keeps the repository lean and makes the signal properties (frequency,
duration, sample rate) easy to verify directly in tests without relying on a reference decoder.

## Helper: `utils/AudioFixtures.ts`

| Export | Description |
|---|---|
| `FIXTURE_FREQS` | Const record mapping friendly names to Hz values (`A4`, `C5`, `G4`) |
| `generateSineWave(hz, sec, sr?)` | Returns a `Float32Array` of PCM samples (default 44 100 Hz) |
| `generateWavBuffer(hz, sec, sr?)` | Wraps the sine wave in a minimal 16-bit mono WAV header and returns a `Buffer` |

## Fixture frequencies

| Name | Frequency (Hz) | Musical note |
|---|---|---|
| `A4` | 440.00 | Concert A — standard tuning reference |
| `C5` | 523.25 | C one octave above middle C |
| `G4` | 392.00 | G below concert A |

## WAV format produced by `generateWavBuffer`

- Container: RIFF/WAVE
- Audio format: PCM (format tag `0x0001`)
- Channels: 1 (mono)
- Bit depth: 16-bit signed integer, little-endian
- Sample rate: configurable (default 44 100 Hz)
- Byte rate: `sampleRate × 2` (1 channel × 2 bytes per sample)

## Adding new fixtures

1. Add the frequency to `FIXTURE_FREQS` in `utils/AudioFixtures.ts`.
2. Document it in the table above.
3. Write a test in `tests/utils/AudioFixtures.test.ts` that verifies its properties.

Do **not** commit raw binary `.wav` files — generate them with `generateWavBuffer` at test time.
