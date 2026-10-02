export interface DecodedWav {
  samples: Float32Array;
  sampleRate: number;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += String.fromCharCode(view.getUint8(offset + i));
  }
  return result;
}

/**
 * Decode a little-endian 16-bit PCM WAV file into mono float samples.
 * Multi-channel audio is down-mixed by averaging channels. Unknown chunks
 * (e.g. the `FLLR` padding chunk written by iOS) are skipped.
 */
export function decodeWav(bytes: Uint8Array): DecodedWav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }

  let offset = 12;
  let sampleRate = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;

  while (offset + 8 <= bytes.byteLength) {
    const chunkId = readAscii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const bodyStart = offset + 8;

    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(bodyStart, true);
      numChannels = view.getUint16(bodyStart + 2, true);
      sampleRate = view.getUint32(bodyStart + 4, true);
      bitsPerSample = view.getUint16(bodyStart + 14, true);
    } else if (chunkId === 'data') {
      // WAVE_FORMAT_EXTENSIBLE (0xfffe) wraps PCM in the same layout.
      if ((audioFormat !== 1 && audioFormat !== 0xfffe) || bitsPerSample !== 16 || numChannels < 1) {
        throw new Error('Only 16-bit PCM WAV files are supported');
      }
      const dataSize = Math.min(chunkSize, bytes.byteLength - bodyStart);
      const frameSize = numChannels * 2;
      const numFrames = Math.floor(dataSize / frameSize);
      const samples = new Float32Array(numFrames);
      for (let frame = 0; frame < numFrames; frame++) {
        let sum = 0;
        for (let channel = 0; channel < numChannels; channel++) {
          sum += view.getInt16(bodyStart + frame * frameSize + channel * 2, true);
        }
        samples[frame] = sum / numChannels / 32768;
      }
      return { samples, sampleRate };
    }

    // Chunks are word-aligned.
    offset = bodyStart + chunkSize + (chunkSize % 2);
  }

  throw new Error('WAV file has no data chunk');
}

/** Encode mono float samples in [-1, 1] as a 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataSize = samples.length * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  // React Native's JS engines run on little-endian hardware, so a typed view
  // writes the PCM body in WAV byte order without per-sample DataView calls.
  const pcm = new Int16Array(bytes.buffer, 44, samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = Math.round(clamped * 32767);
  }

  return bytes;
}
