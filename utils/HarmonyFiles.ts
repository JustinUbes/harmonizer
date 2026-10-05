import { Directory, File, Paths } from 'expo-file-system';
import { canRenderHarmony, PlaybackMode, renderHarmonyWav } from './HarmonyRender';

interface HarmonySource {
  uri: string;
  harmonySemitones?: number;
}

const HARMONY_MODES: ReadonlyArray<Exclude<PlaybackMode, 'melody'>> = ['mix', 'harmony'];

function harmonyDirectory(): Directory {
  return new Directory(Paths.cache, 'harmony');
}

function renderBaseName(recordingUri: string): string {
  const fileName = recordingUri.split('/').pop() ?? 'recording';
  return fileName.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function harmonyRenderFile(
  recordingUri: string,
  semitones: number,
  mode: Exclude<PlaybackMode, 'melody'>
): File {
  return new File(harmonyDirectory(), `${renderBaseName(recordingUri)}-${mode}-${semitones}.wav`);
}

/**
 * Resolve the file to play for a recording in the given mode. Harmony renders
 * are produced once and cached; recordings that cannot be rendered (no stored
 * interval or non-PCM audio) fall back to the original melody.
 */
export async function resolvePlaybackUri(recording: HarmonySource, mode: PlaybackMode): Promise<string> {
  if (mode === 'melody' || !canRenderHarmony(recording)) {
    return recording.uri;
  }

  const semitones = recording.harmonySemitones as number;
  const target = harmonyRenderFile(recording.uri, semitones, mode);
  if (target.exists) {
    return target.uri;
  }

  const melodyBytes = await new File(recording.uri).bytes();
  const rendered = renderHarmonyWav(melodyBytes, semitones, mode);
  harmonyDirectory().create({ idempotent: true, intermediates: true });
  target.create({ overwrite: true });
  target.write(rendered);
  return target.uri;
}

/** Delete a recording's audio file along with any cached harmony renders. */
export function deleteRecordingFiles(recording: HarmonySource): void {
  const files = [new File(recording.uri)];
  if (typeof recording.harmonySemitones === 'number') {
    for (const mode of HARMONY_MODES) {
      files.push(harmonyRenderFile(recording.uri, recording.harmonySemitones, mode));
    }
  }
  for (const file of files) {
    if (file.exists) {
      file.delete();
    }
  }
}
