import { generateWavBuffer } from '../../utils/AudioFixtures';
import { deleteRecordingFiles, resolvePlaybackUri } from '../../utils/HarmonyFiles';
import { decodeWav } from '../../utils/Wav';

const mockFiles = new Map<string, Uint8Array>();

jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;
    constructor(...parts: (string | MockDirectory)[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    create = jest.fn();
  }

  class MockFile {
    uri: string;
    constructor(...parts: (string | MockDirectory)[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    async bytes() {
      const bytes = mockFiles.get(this.uri);
      if (!bytes) throw new Error(`missing ${this.uri}`);
      return bytes;
    }
    create() {
      mockFiles.set(this.uri, new Uint8Array());
    }
    write(content: Uint8Array) {
      mockFiles.set(this.uri, content);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }

  return { File: MockFile, Directory: MockDirectory, Paths: { cache: new MockDirectory('file:///cache') } };
});

const wavRecording = { uri: 'file:///docs/take 1.wav', harmonySemitones: 7 };
const mixRenderUri = 'file:///cache/harmony/take_1-mix-7.wav';
const harmonyRenderUri = 'file:///cache/harmony/take_1-harmony-7.wav';

describe('HarmonyFiles', () => {
  beforeEach(() => {
    mockFiles.clear();
    mockFiles.set(wavRecording.uri, new Uint8Array(generateWavBuffer(440, 0.2)));
  });

  it('plays the original file in melody mode or when harmony cannot be rendered', async () => {
    await expect(resolvePlaybackUri(wavRecording, 'melody')).resolves.toBe(wavRecording.uri);
    await expect(resolvePlaybackUri({ uri: 'file:///docs/a.m4a', harmonySemitones: 4 }, 'mix')).resolves.toBe(
      'file:///docs/a.m4a'
    );
  });

  it('renders a harmony file once and reuses the cached render', async () => {
    await expect(resolvePlaybackUri(wavRecording, 'mix')).resolves.toBe(mixRenderUri);
    const rendered = mockFiles.get(mixRenderUri) as Uint8Array;
    expect(decodeWav(rendered).samples).toHaveLength(decodeWav(mockFiles.get(wavRecording.uri) as Uint8Array).samples.length);

    mockFiles.set(mixRenderUri, Uint8Array.from([1, 2, 3]));
    await expect(resolvePlaybackUri(wavRecording, 'mix')).resolves.toBe(mixRenderUri);
    expect(mockFiles.get(mixRenderUri)).toEqual(Uint8Array.from([1, 2, 3]));
  });

  it('deletes the recording along with its cached harmony renders', async () => {
    await resolvePlaybackUri(wavRecording, 'mix');
    await resolvePlaybackUri(wavRecording, 'harmony');
    expect(mockFiles.has(harmonyRenderUri)).toBe(true);

    deleteRecordingFiles(wavRecording);

    expect(mockFiles.size).toBe(0);
  });
});
