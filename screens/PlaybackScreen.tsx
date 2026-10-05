import React, { useState, useRef, useEffect } from 'react';
import { View, FlatList, Text, Image, TouchableOpacity } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import * as Sharing from 'expo-sharing';
import { useDispatch, useSelector } from 'react-redux';
import { delRec } from '../store/redux/recordings';
import { RootState } from '../store/redux/store';
import { Recording } from '../store/redux/recordings';
import styles from '../styles';
import PlaybackItem from '../components/PlaybackItem';
import { HARMONY_INTERVALS } from '../utils/HarmonyIntervals';
import { canRenderHarmony, PLAYBACK_MODES, PlaybackMode } from '../utils/HarmonyRender';
import { deleteRecordingFiles, resolvePlaybackUri } from '../utils/HarmonyFiles';

const PROGRESS_UPDATE_INTERVAL_MS = 100;
const EXACT_SEEK = { toleranceMillisBefore: 0, toleranceMillisAfter: 0 };
const PLAYER_LOAD_TIMEOUT_MS = 5000;

interface LoadedSound {
  sound: PlaybackController;
  uri: string;
  mode: PlaybackMode;
}

interface PlaybackController {
  playFromPositionAsync: (positionMillis: number, seek: typeof EXACT_SEEK) => Promise<AVPlaybackStatus>;
  pauseAsync: () => Promise<AVPlaybackStatus>;
  setPositionAsync: (positionMillis: number, seek: typeof EXACT_SEEK) => Promise<AVPlaybackStatus>;
  getStatusAsync: () => Promise<AVPlaybackStatus>;
  unloadAsync: () => Promise<void>;
}

function isLoadForSoundUnavailableError(err: unknown): boolean {
  const message =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message)
        : String(err);
  return /loadForSound|expo-av native method/i.test(message);
}

function toPlaybackStatus(player: AudioPlayer, didJustFinish = false): AVPlaybackStatus {
  return {
    isLoaded: player.isLoaded,
    isPlaying: player.playing,
    didJustFinish,
    positionMillis: Math.round(Math.max(0, player.currentTime || 0) * 1000),
    durationMillis: Math.round(Math.max(0, player.duration || 0) * 1000),
    androidImplementation: 'MediaPlayer',
    shouldPlay: player.playing,
    isBuffering: player.isBuffering,
    rate: player.playbackRate,
    shouldCorrectPitch: player.shouldCorrectPitch,
    volume: player.volume,
    isMuted: player.muted,
    isLooping: player.loop,
    playableDurationMillis: null,
    uri: null,
  } as AVPlaybackStatus;
}

function createExpoAudioController(
  sourceUri: string,
  onStatus: (status: AVPlaybackStatus) => void
): PlaybackController {
  const player = createAudioPlayer({ uri: sourceUri }, {
    updateInterval: PROGRESS_UPDATE_INTERVAL_MS,
  });

  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    onStatus({
      isLoaded: status.isLoaded,
      isPlaying: status.playing,
      didJustFinish: status.didJustFinish,
      positionMillis: Math.round(Math.max(0, status.currentTime || 0) * 1000),
      durationMillis: Math.round(Math.max(0, status.duration || 0) * 1000),
      androidImplementation: 'MediaPlayer',
      shouldPlay: status.playing,
      isBuffering: status.isBuffering,
      rate: status.playbackRate,
      shouldCorrectPitch: status.shouldCorrectPitch,
      volume: player.volume,
      isMuted: player.muted,
      isLooping: player.loop,
      playableDurationMillis: null,
      uri: null,
    } as AVPlaybackStatus);
  });

  let isReleased = false;
  const pendingLoadWaits = new Set<() => void>();

  // Seeking before the source is ready is ignored natively, which would restart playback from 0.
  function waitUntilLoaded(): Promise<void> {
    if (player.isLoaded || isReleased) return Promise.resolve();
    return new Promise((resolve) => {
      const loadSubscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.isLoaded) finish();
      });
      const timeout = setTimeout(finish, PLAYER_LOAD_TIMEOUT_MS);
      pendingLoadWaits.add(finish);
      function finish() {
        clearTimeout(timeout);
        loadSubscription.remove();
        pendingLoadWaits.delete(finish);
        resolve();
      }
    });
  }

  return {
    async playFromPositionAsync(positionMillis, seek) {
      await waitUntilLoaded();
      if (isReleased) return toPlaybackStatus(player);
      await player.seekTo(
        positionMillis / 1000,
        seek.toleranceMillisBefore,
        seek.toleranceMillisAfter
      );
      player.play();
      return toPlaybackStatus(player);
    },
    async pauseAsync() {
      player.pause();
      return toPlaybackStatus(player);
    },
    async setPositionAsync(positionMillis, seek) {
      await waitUntilLoaded();
      if (isReleased) return toPlaybackStatus(player);
      await player.seekTo(
        positionMillis / 1000,
        seek.toleranceMillisBefore,
        seek.toleranceMillisAfter
      );
      return toPlaybackStatus(player);
    },
    async getStatusAsync() {
      return toPlaybackStatus(player);
    },
    async unloadAsync() {
      if (isReleased) return;
      isReleased = true;
      // remove() only drops the JS reference; pause first so the old source can't keep playing.
      try {
        player.pause();
      } catch (err) {
        console.warn('Error pausing audio player before release:', err);
      }
      pendingLoadWaits.forEach((finish) => finish());
      subscription.remove();
      player.remove();
    },
  };
}

function harmonyCaption(recording: Recording, mode: PlaybackMode): string | undefined {
  if (mode === 'melody') return undefined;
  if (!canRenderHarmony(recording)) return 'Harmony unavailable, playing melody';
  const semitones = recording.harmonySemitones as number;
  const interval = HARMONY_INTERVALS.find((candidate) => candidate.semitones === semitones);
  return `Harmony: ${interval ? interval.label : `${semitones} semitones`}`;
}

function PlaybackScreen() {
  const [activeUri, setActiveUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('mix');
  const dispatch = useDispatch();
  const recordings = useSelector((state: RootState) => state.allRecordings.recordings);

  // Refs mirror the state that async expo-av work reads, so queued commands and
  // status callbacks always see the latest user intent instead of stale closures.
  const loadedRef = useRef<LoadedSound | null>(null);
  const loadTokenRef = useRef(0);
  const activeUriRef = useRef<string | null>(null);
  const wantsPlaybackRef = useRef(false);
  const positionRef = useRef(0);
  const modeRef = useRef<PlaybackMode>('mix');
  const isScrubbingRef = useRef(false);
  const pendingSeeksRef = useRef(0);
  const commandQueueRef = useRef<Promise<void>>(Promise.resolve());
  const recordingsRef = useRef(recordings);
  recordingsRef.current = recordings;

  useEffect(() => {
    return () => {
      loadTokenRef.current += 1;
      const loaded = loadedRef.current;
      loadedRef.current = null;
      loaded?.sound.unloadAsync().catch(() => null);
    };
  }, []);

  // Serialize every expo-av command so play, pause, seek, and reloads never interleave.
  function enqueue(command: () => Promise<void>) {
    commandQueueRef.current = commandQueueRef.current
      .then(command)
      .catch((err) => console.error('Playback error:', err));
  }

  function updatePosition(positionMillis: number) {
    positionRef.current = positionMillis;
    setCurrentPosition(positionMillis);
  }

  function updatePlaying(playing: boolean) {
    wantsPlaybackRef.current = playing;
    setIsPlaying(playing);
  }

  function canAcceptStatusPosition() {
    return !isScrubbingRef.current && pendingSeeksRef.current === 0;
  }

  function handlePlaybackStatus(token: number, status: AVPlaybackStatus) {
    if (token !== loadTokenRef.current || !status.isLoaded) return;
    if (status.didJustFinish) {
      updatePlaying(false);
      updatePosition(0);
      return;
    }
    // Ignore progress while paused, scrubbing, or seeking so stale updates can't jump the seeker back.
    if (wantsPlaybackRef.current && canAcceptStatusPosition()) {
      updatePosition(status.positionMillis);
    }
  }

  async function unloadSound() {
    loadTokenRef.current += 1;
    const loaded = loadedRef.current;
    loadedRef.current = null;
    if (loaded) {
      await loaded.sound.unloadAsync().catch(() => null);
    }
  }

  async function ensureLoaded(recording: Recording): Promise<PlaybackController | null> {
    const mode = modeRef.current;
    const loaded = loadedRef.current;
    if (loaded && loaded.uri === recording.uri && loaded.mode === mode) {
      return loaded.sound;
    }

    await unloadSound();
    const token = loadTokenRef.current;
    setIsLoading(true);
    try {
      let sourceUri = recording.uri;
      try {
        sourceUri = await resolvePlaybackUri(recording, mode);
      } catch (err) {
        console.error('Error rendering harmony:', err);
      }
      if (token !== loadTokenRef.current || activeUriRef.current !== recording.uri) return null;

      let sound: PlaybackController;
      try {
        const loaded = await Audio.Sound.createAsync(
          { uri: sourceUri },
          {
            shouldPlay: false,
            positionMillis: positionRef.current,
            progressUpdateIntervalMillis: PROGRESS_UPDATE_INTERVAL_MS,
          },
          (status) => handlePlaybackStatus(token, status)
        );
        sound = loaded.sound as unknown as PlaybackController;
      } catch (err) {
        if (!isLoadForSoundUnavailableError(err)) {
          throw err;
        }
        console.warn('expo-av Sound unavailable, using expo-audio playback fallback');
        sound = createExpoAudioController(sourceUri, (status) => handlePlaybackStatus(token, status));
      }
      if (token !== loadTokenRef.current) {
        await sound.unloadAsync().catch(() => null);
        return null;
      }
      loadedRef.current = { sound, uri: recording.uri, mode };
      return sound;
    } finally {
      setIsLoading(false);
    }
  }

  async function startPlayback(recording: Recording) {
    if (!wantsPlaybackRef.current || isScrubbingRef.current) return;
    if (activeUriRef.current !== recording.uri) return;
    // Loading and seeking to the cued position count as a seek, so early status from a
    // freshly loaded source (still at 0) can't snap the seeker back to the start.
    pendingSeeksRef.current += 1;
    try {
      const sound = await ensureLoaded(recording);
      if (!sound || !wantsPlaybackRef.current || isScrubbingRef.current) return;
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) return;
      await sound.playFromPositionAsync(positionRef.current, EXACT_SEEK);
    } catch (err) {
      console.error('Error playing audio:', err);
      updatePlaying(false);
    } finally {
      pendingSeeksRef.current -= 1;
    }
  }

  function selectRecording(uri: string | null) {
    loadTokenRef.current += 1;
    isScrubbingRef.current = false;
    activeUriRef.current = uri;
    setActiveUri(uri);
    updatePlaying(false);
    updatePosition(0);
    enqueue(unloadSound);
  }

  function togglePlayback(recording: Recording) {
    if (activeUriRef.current !== recording.uri) {
      selectRecording(recording.uri);
    }
    // A button tap means no drag is in progress; never let a missed slide-complete block playback.
    isScrubbingRef.current = false;

    if (wantsPlaybackRef.current) {
      updatePlaying(false);
      enqueue(async () => {
        const loaded = loadedRef.current;
        if (!loaded || wantsPlaybackRef.current) return;
        const status = await loaded.sound.pauseAsync();
        if (status.isLoaded && canAcceptStatusPosition()) {
          updatePosition(status.positionMillis);
        }
      });
      return;
    }

    updatePlaying(true);
    enqueue(() => startPlayback(recording));
  }

  function handleScrubStart(recording: Recording) {
    if (activeUriRef.current !== recording.uri) {
      selectRecording(recording.uri);
    }
    isScrubbingRef.current = true;
    // Pause while dragging to avoid glitchy audio; the play intent is kept so release resumes.
    enqueue(async () => {
      const loaded = loadedRef.current;
      if (loaded && isScrubbingRef.current && wantsPlaybackRef.current) {
        await loaded.sound.pauseAsync();
      }
    });
  }

  function handleSeek(recording: Recording, positionMillis: number) {
    if (activeUriRef.current !== recording.uri) {
      selectRecording(recording.uri);
    }
    isScrubbingRef.current = false;
    const maxPosition = recording.duration > 0 ? recording.duration : 0;
    updatePosition(Math.min(Math.max(0, Math.round(positionMillis)), maxPosition));
    pendingSeeksRef.current += 1;
    enqueue(async () => {
      try {
        const loaded = loadedRef.current;
        if (!loaded || loaded.uri !== recording.uri) {
          // Not loaded yet: the cued position is used when playback starts. A queued
          // start may have been skipped while dragging, so start it now if still wanted.
          if (wantsPlaybackRef.current && activeUriRef.current === recording.uri) {
            await startPlayback(recording);
          }
          return;
        }
        if (wantsPlaybackRef.current) {
          await loaded.sound.playFromPositionAsync(positionRef.current, EXACT_SEEK);
        } else {
          await loaded.sound.setPositionAsync(positionRef.current, EXACT_SEEK);
        }
      } finally {
        pendingSeeksRef.current -= 1;
      }
    });
  }

  function changePlaybackMode(mode: PlaybackMode) {
    if (mode === modeRef.current) return;
    modeRef.current = mode;
    setPlaybackMode(mode);
    enqueue(async () => {
      const loaded = loadedRef.current;
      if (!loaded || loaded.mode === modeRef.current) return;
      // Stop the current source before swapping so the old and new modes never overlap,
      // then resume the new mode from where the old one stopped.
      const status = await loaded.sound.pauseAsync();
      if (status.isLoaded && canAcceptStatusPosition()) {
        updatePosition(status.positionMillis);
      }
      const recording = recordingsRef.current.find((candidate) => candidate.uri === loaded.uri);
      await unloadSound();
      if (recording) {
        await startPlayback(recording);
      }
    });
  }

  function deleteRecording(recording: Recording) {
    if (activeUriRef.current === recording.uri) {
      selectRecording(null);
    }
    dispatch(delRec({ uri: recording.uri }));
    enqueue(async () => {
      try {
        deleteRecordingFiles(recording);
      } catch (err) {
        console.error('Error deleting recording:', err);
      }
    });
  }

  async function shareRecording(uri: string) {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) return;
      const isWav = /\.wav$/i.test(uri);
      await Sharing.shareAsync(uri, {
        mimeType: isWav ? 'audio/wav' : 'audio/m4a',
        UTI: isWav ? 'com.microsoft.waveform-audio' : 'public.mpeg-4-audio',
        dialogTitle: 'Share your recording',
      });
    } catch (err) {
      console.error('Error sharing recording:', err);
    }
  }

  function renderItem({ item }: { item: Recording }) {
    const isActive = activeUri === item.uri;
    return (
      <PlaybackItem
        uri={item.uri}
        date={item.date}
        duration={item.duration}
        title={item.title}
        isPlaying={isActive && isPlaying}
        isLoading={isActive && isLoading}
        currentPosition={isActive ? currentPosition : 0}
        harmonyCaption={harmonyCaption(item, playbackMode)}
        onPlay={() => togglePlayback(item)}
        onDelete={() => deleteRecording(item)}
        onScrubStart={() => handleScrubStart(item)}
        onSeek={(pos) => handleSeek(item, pos)}
        onShare={() => shareRecording(item.uri)}
      />
    );
  }

  function renderModeSelector() {
    return (
      <View style={[styles.intervalContainer, { marginBottom: 8 }]} accessibilityRole="radiogroup">
        {PLAYBACK_MODES.map(({ mode, label }) => {
          const isSelected = playbackMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              style={[styles.intervalButton, isSelected && styles.intervalButtonActive]}
              onPress={() => changePlaybackMode(mode)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.intervalButtonText, isSelected && styles.intervalButtonTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (recordings.length === 0) {
    return (
      <View style={styles.container}>
        <Image source={require('../assets/logo.png')} style={styles.logoImage} />
        <Text style={styles.emptyStateText}>
          No recordings yet.{'\n'}Head to Record to get started!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={recordings}
        renderItem={renderItem}
        keyExtractor={(item) => item.uri}
        ListHeaderComponent={renderModeSelector()}
        style={{ width: '100%' }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
      />
    </View>
  );
}

export default PlaybackScreen;
