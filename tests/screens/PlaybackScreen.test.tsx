import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import PlaybackScreen from '../../screens/PlaybackScreen';
import { delRec, Recording } from '../../store/redux/recordings';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

jest.mock('@react-native-community/slider', () => {
  const { View } = jest.requireActual('react-native');
  return function MockSlider(props: object) {
    return <View {...props} />;
  };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockResolvePlaybackUri = jest.fn();
const mockDeleteRecordingFiles = jest.fn();
jest.mock('../../utils/HarmonyFiles', () => ({
  resolvePlaybackUri: (...args: unknown[]) => mockResolvePlaybackUri(...args),
  deleteRecordingFiles: (...args: unknown[]) => mockDeleteRecordingFiles(...args),
}));

const mockDispatch = jest.fn();
let mockRecordings: Recording[] = [];
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ allRecordings: { recordings: mockRecordings } }),
}));

type StatusCallback = (status: Record<string, unknown>) => void;

const mockCreateAsync = jest.fn();
const mockCreateAudioPlayer = jest.fn();
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: (...args: unknown[]) => mockCreateAsync(...args),
    },
  },
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
}));

interface MockSound {
  playFromPositionAsync: jest.Mock;
  setPositionAsync: jest.Mock;
  pauseAsync: jest.Mock;
  getStatusAsync: jest.Mock;
  unloadAsync: jest.Mock;
  emit: StatusCallback;
}

const EXACT_SEEK = { toleranceMillisBefore: 0, toleranceMillisAfter: 0 };

const melodyRecording: Recording = {
  uri: 'file:///recordings/take-1.wav',
  date: 'Aug 8, 2026, 6:38 PM',
  duration: 10000,
  title: 'Take 1',
  harmonySemitones: 4,
};

const legacyRecording: Recording = {
  uri: 'file:///recordings/take-0.m4a',
  date: 'Aug 7, 2026, 6:38 PM',
  duration: 8000,
  title: 'Take 0',
};

describe('PlaybackScreen', () => {
  let sounds: MockSound[];

  function latestSound(): MockSound {
    return sounds[sounds.length - 1];
  }

  function emitStatus(status: Record<string, unknown>) {
    act(() => {
      latestSound().emit({ isLoaded: true, isPlaying: true, ...status });
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRecordings = [melodyRecording];
    sounds = [];
    mockResolvePlaybackUri.mockImplementation(
      async (recording: Recording, mode: string) => `${recording.uri}#${mode}`
    );
    mockCreateAsync.mockImplementation(
      async (_source: unknown, _initialStatus: unknown, onStatus: StatusCallback) => {
        const sound: MockSound = {
          playFromPositionAsync: jest.fn().mockResolvedValue({ isLoaded: true }),
          setPositionAsync: jest.fn().mockResolvedValue({ isLoaded: true }),
          pauseAsync: jest.fn().mockResolvedValue({ isLoaded: true, positionMillis: 0 }),
          getStatusAsync: jest
            .fn()
            .mockResolvedValue({ isLoaded: true, isPlaying: false, positionMillis: 0 }),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
          emit: onStatus,
        };
        sounds.push(sound);
        return { sound };
      }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts playback from the seeker position chosen before pressing play', async () => {
    const screen = render(<PlaybackScreen />);
    const slider = screen.getByLabelText('Playback position');

    fireEvent(slider, 'slidingStart', 0);
    fireEvent(slider, 'slidingComplete', 3000);
    expect(screen.getByText('0:03')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Play' }));

    await waitFor(() => {
      expect(latestSound().playFromPositionAsync).toHaveBeenCalledWith(3000, EXACT_SEEK);
    });
    expect(mockCreateAsync).toHaveBeenCalledWith(
      { uri: `${melodyRecording.uri}#mix` },
      expect.objectContaining({ positionMillis: 3000, shouldPlay: false }),
      expect.any(Function)
    );
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('updates the position continuously from playback status while playing', async () => {
    const screen = render(<PlaybackScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(sounds).toHaveLength(1));

    emitStatus({ positionMillis: 1200 });
    expect(screen.getByText('0:01')).toBeTruthy();

    emitStatus({ positionMillis: 2400 });
    expect(screen.getByText('0:02')).toBeTruthy();
  });

  it('pauses while scrubbing, tracks the drag in real time, and resumes from the release point', async () => {
    const screen = render(<PlaybackScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(latestSound().playFromPositionAsync).toHaveBeenCalledTimes(1));
    emitStatus({ positionMillis: 1000 });

    const slider = screen.getByLabelText('Playback position');
    fireEvent(slider, 'slidingStart', 1000);
    await waitFor(() => expect(latestSound().pauseAsync).toHaveBeenCalledTimes(1));

    fireEvent(slider, 'valueChange', 4000);
    expect(screen.getByText('0:04')).toBeTruthy();
    fireEvent(slider, 'valueChange', 6500);
    expect(screen.getByText('0:06')).toBeTruthy();

    // Stale progress from before the drag must not move the seeker.
    emitStatus({ positionMillis: 1100 });
    expect(screen.getByText('0:06')).toBeTruthy();

    fireEvent(slider, 'slidingComplete', 6500);

    await waitFor(() => {
      expect(latestSound().playFromPositionAsync).toHaveBeenLastCalledWith(6500, EXACT_SEEK);
    });
    expect(screen.getByText('0:06')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(mockCreateAsync).toHaveBeenCalledTimes(1);
  });

  it('ignores in-flight status updates until a seek completes, then follows playback again', async () => {
    const screen = render(<PlaybackScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(latestSound().playFromPositionAsync).toHaveBeenCalledTimes(1));

    let resolveSeek!: (value: unknown) => void;
    latestSound().playFromPositionAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSeek = resolve;
      })
    );

    const slider = screen.getByLabelText('Playback position');
    fireEvent(slider, 'slidingStart', 0);
    fireEvent(slider, 'slidingComplete', 7000);
    await waitFor(() => expect(latestSound().playFromPositionAsync).toHaveBeenCalledTimes(2));

    emitStatus({ positionMillis: 500 });
    expect(screen.getByText('0:07')).toBeTruthy();

    await act(async () => {
      resolveSeek({ isLoaded: true });
    });
    emitStatus({ positionMillis: 7200 });
    expect(screen.getByText('0:07')).toBeTruthy();
    emitStatus({ positionMillis: 8100 });
    expect(screen.getByText('0:08')).toBeTruthy();
  });

  it('seeks without resuming when paused, and play then starts from the new position', async () => {
    const screen = render(<PlaybackScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(latestSound().playFromPositionAsync).toHaveBeenCalledTimes(1));
    emitStatus({ positionMillis: 2000 });

    latestSound().pauseAsync.mockResolvedValueOnce({ isLoaded: true, positionMillis: 2050 });
    fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(latestSound().pauseAsync).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();

    const slider = screen.getByLabelText('Playback position');
    fireEvent(slider, 'slidingStart', 2050);
    fireEvent(slider, 'slidingComplete', 5000);
    await waitFor(() => {
      expect(latestSound().setPositionAsync).toHaveBeenCalledWith(5000, EXACT_SEEK);
    });
    expect(latestSound().playFromPositionAsync).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => {
      expect(latestSound().playFromPositionAsync).toHaveBeenLastCalledWith(5000, EXACT_SEEK);
    });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('keeps play/pause responsive for rapid taps after a seek', async () => {
    const screen = render(<PlaybackScreen />);
    const slider = screen.getByLabelText('Playback position');
    fireEvent(slider, 'slidingStart', 0);
    fireEvent(slider, 'slidingComplete', 2000);

    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();

    await waitFor(() => {
      expect(latestSound().playFromPositionAsync).toHaveBeenCalledWith(2000, EXACT_SEEK);
    });
    expect(mockCreateAsync).toHaveBeenCalledTimes(1);
  });

  it('starts playback on release when a queued play was skipped during the drag', async () => {
    const otherRecording: Recording = { ...melodyRecording, uri: 'file:///recordings/take-2.wav' };
    mockRecordings = [melodyRecording, otherRecording];
    let finishFirstRender!: (uri: string) => void;
    mockResolvePlaybackUri.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishFirstRender = resolve;
        })
    );

    const screen = render(<PlaybackScreen />);
    const [firstPlay, secondPlay] = screen.getAllByRole('button', { name: 'Play' });
    fireEvent.press(firstPlay);
    await waitFor(() => expect(mockResolvePlaybackUri).toHaveBeenCalledTimes(1));

    fireEvent.press(secondPlay);
    const secondSlider = screen.getAllByLabelText('Playback position')[1];
    fireEvent(secondSlider, 'slidingStart', 0);

    await act(async () => {
      finishFirstRender(`${melodyRecording.uri}#mix`);
    });
    fireEvent(secondSlider, 'slidingComplete', 4000);

    await waitFor(() => {
      expect(latestSound().playFromPositionAsync).toHaveBeenCalledWith(4000, EXACT_SEEK);
    });
    expect(mockCreateAsync).toHaveBeenCalledTimes(1);
    expect(mockCreateAsync).toHaveBeenCalledWith(
      { uri: `${otherRecording.uri}#mix` },
      expect.objectContaining({ positionMillis: 4000 }),
      expect.any(Function)
    );
  });

  it('resets to the start when playback finishes and replays from zero', async () => {
    const screen = render(<PlaybackScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(latestSound().playFromPositionAsync).toHaveBeenCalledTimes(1));

    emitStatus({ positionMillis: 9000 });
    emitStatus({ positionMillis: 10000, didJustFinish: true, isPlaying: false });
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    expect(screen.getAllByText('0:00').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => {
      expect(latestSound().playFromPositionAsync).toHaveBeenLastCalledWith(0, EXACT_SEEK);
    });
  });

  it('switches between melody + harmony and harmony-only playback at the current position', async () => {
    const screen = render(<PlaybackScreen />);
    expect(screen.getByRole('radio', { name: 'Melody + Harmony' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByText('Harmony: Major 3rd')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(latestSound().playFromPositionAsync).toHaveBeenCalledTimes(1));
    expect(mockResolvePlaybackUri).toHaveBeenLastCalledWith(melodyRecording, 'mix');

    const mixSound = latestSound();
    mixSound.getStatusAsync.mockResolvedValue({ isLoaded: true, isPlaying: true, positionMillis: 4000 });
    fireEvent.press(screen.getByRole('radio', { name: 'Harmony Only' }));

    await waitFor(() => expect(sounds).toHaveLength(2));
    await waitFor(() => {
      expect(latestSound().playFromPositionAsync).toHaveBeenCalledWith(4000, EXACT_SEEK);
    });
    expect(mixSound.unloadAsync).toHaveBeenCalled();
    expect(mockResolvePlaybackUri).toHaveBeenLastCalledWith(melodyRecording, 'harmony');
    expect(mockCreateAsync).toHaveBeenLastCalledWith(
      { uri: `${melodyRecording.uri}#harmony` },
      expect.objectContaining({ positionMillis: 4000 }),
      expect.any(Function)
    );

    // Status from the unloaded mix sound must not move the seeker.
    act(() => {
      mixSound.emit({ isLoaded: true, isPlaying: true, positionMillis: 100 });
    });
    expect(screen.getByText('0:04')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('explains when a recording cannot be harmonized and still plays the melody', async () => {
    mockRecordings = [legacyRecording];
    const screen = render(<PlaybackScreen />);

    expect(screen.getByText('Harmony unavailable, playing melody')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Melody' }));
    expect(screen.queryByText('Harmony unavailable, playing melody')).toBeNull();
  });

  it('falls back to the melody when rendering the harmony fails', async () => {
    mockResolvePlaybackUri.mockRejectedValueOnce(new Error('render failed'));
    const screen = render(<PlaybackScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Play' }));

    await waitFor(() => expect(latestSound().playFromPositionAsync).toHaveBeenCalledWith(0, EXACT_SEEK));
    expect(mockCreateAsync).toHaveBeenCalledWith(
      { uri: melodyRecording.uri },
      expect.anything(),
      expect.any(Function)
    );
  });

  it('unloads the active sound and deletes recording files on delete', async () => {
    const screen = render(<PlaybackScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(latestSound().playFromPositionAsync).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByRole('button', { name: 'Delete recording' }));

    expect(mockDispatch).toHaveBeenCalledWith(delRec({ uri: melodyRecording.uri }));
    await waitFor(() => expect(mockDeleteRecordingFiles).toHaveBeenCalledWith(melodyRecording));
    expect(latestSound().unloadAsync).toHaveBeenCalled();
  });
});
