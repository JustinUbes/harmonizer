import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import RecordScreen from '../../screens/RecordScreen';
import PlaybackScreen from '../../screens/PlaybackScreen';
import recordingsReducer from '../../store/redux/recordings';
import AppButton from '../../components/AppButton';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'Light',
  },
}));

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/CurrentDate', () => ({
  getCurrentDate: jest.fn(() => 'Aug 8, 2026, 6:38 PM'),
}));

const mockSetAudioModeAsync = jest.fn();
const mockCreateAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetPermissionsAsync = jest.fn();
const mockExpoAudioGetRecordingPermissionsAsync = jest.fn();
const mockExpoAudioRequestPermissionsAsync = jest.fn();
const mockExpoAudioSetAudioModeAsync = jest.fn();
const mockExpoAudioPrepareToRecordAsync = jest.fn();
const mockExpoAudioRecord = jest.fn();
const mockExpoAudioStop = jest.fn();
const mockExpoAudioGetStatus = jest.fn();

const mockExpoAudioRecorder = {
  prepareToRecordAsync: (...args: unknown[]) => mockExpoAudioPrepareToRecordAsync(...args),
  record: (...args: unknown[]) => mockExpoAudioRecord(...args),
  stop: (...args: unknown[]) => mockExpoAudioStop(...args),
  getStatus: (...args: unknown[]) => mockExpoAudioGetStatus(...args),
  uri: 'file:///recordings/fallback.wav',
};

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
    getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
    setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
    Recording: {
      createAsync: (...args: unknown[]) => mockCreateAsync(...args),
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: {
        android: { extension: '.m4a' },
        ios: { extension: '.m4a', outputFormat: 'aac ' },
        web: {},
      },
    },
    IOSOutputFormat: {
      LINEARPCM: 'lpcm',
    },
    Sound: jest.fn().mockImplementation(() => ({
      getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: false }),
      loadAsync: jest.fn().mockResolvedValue(undefined),
      playAsync: jest.fn().mockResolvedValue(undefined),
      pauseAsync: jest.fn().mockResolvedValue(undefined),
      stopAsync: jest.fn().mockResolvedValue(undefined),
      unloadAsync: jest.fn().mockResolvedValue(undefined),
      setPositionAsync: jest.fn().mockResolvedValue(undefined),
      setOnPlaybackStatusUpdate: jest.fn(),
    })),
  },
}));

jest.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: (...args: unknown[]) =>
    mockExpoAudioGetRecordingPermissionsAsync(...args),
  requestRecordingPermissionsAsync: (...args: unknown[]) => mockExpoAudioRequestPermissionsAsync(...args),
  setAudioModeAsync: (...args: unknown[]) => mockExpoAudioSetAudioModeAsync(...args),
  useAudioRecorder: () => mockExpoAudioRecorder,
  RecordingPresets: {
    HIGH_QUALITY: {
      extension: '.m4a',
      numberOfChannels: 2,
      ios: {
        outputFormat: 'aac ',
      },
    },
  },
  IOSOutputFormat: {
    LINEARPCM: 'lpcm',
  },
}));

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface MockPermissionResponse {
  status: PermissionStatus;
}

function createTestStore() {
  return configureStore({
    reducer: {
      allRecordings: recordingsReducer,
    },
  });
}

function renderFlow(store = createTestStore()) {
  const screen = render(
    <Provider store={store}>
      <RecordScreen />
      <PlaybackScreen />
    </Provider>
  );
  return { screen, store };
}

describe('Record -> save -> history flow', () => {
  let permissionResponse: MockPermissionResponse;
  let requestPermissionMock: jest.Mock<Promise<MockPermissionResponse>, []>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    permissionResponse = { status: 'granted' };
    requestPermissionMock = jest.fn().mockResolvedValue({ status: 'granted' });
    mockRequestPermissionsAsync.mockImplementation(() => requestPermissionMock());
    mockGetPermissionsAsync.mockResolvedValue(permissionResponse);
    mockExpoAudioGetRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    mockExpoAudioRequestPermissionsAsync.mockResolvedValue({ granted: true });
    mockExpoAudioSetAudioModeAsync.mockResolvedValue(undefined);
    mockExpoAudioPrepareToRecordAsync.mockResolvedValue(undefined);
    mockExpoAudioRecord.mockReturnValue(undefined);
    mockExpoAudioStop.mockResolvedValue(undefined);
    mockExpoAudioGetStatus.mockReturnValue({ durationMillis: 2500 });
    mockExpoAudioRecorder.uri = 'file:///recordings/fallback.wav';
    mockSetAudioModeAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  describe('microphone permission', () => {
    it('prompts for permission when undetermined and records once granted', async () => {
      mockExpoAudioGetRecordingPermissionsAsync.mockResolvedValue({ granted: false });
      const { screen, store } = renderFlow();

      fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
      });
      expect(mockExpoAudioRequestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(mockExpoAudioPrepareToRecordAsync).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByRole('button', { name: 'Stop Recording' }));

      await waitFor(() => {
        expect(store.getState().allRecordings.recordings).toHaveLength(1);
      });
    });

    it('does not prompt again when permission is already granted', async () => {
      const { screen } = renderFlow();

      fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
      });
      expect(mockExpoAudioRequestPermissionsAsync).not.toHaveBeenCalled();
      expect(mockExpoAudioPrepareToRecordAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: '.wav',
          ios: expect.objectContaining({ outputFormat: 'lpcm' }),
        })
      );
    });

    it('leaves the audio session and history untouched when permission is denied', async () => {
      mockExpoAudioGetRecordingPermissionsAsync.mockResolvedValue({ granted: false });
      mockExpoAudioRequestPermissionsAsync.mockResolvedValue({ granted: false });
      const { screen, store } = renderFlow();

      fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

      await waitFor(() => {
        expect(mockExpoAudioRequestPermissionsAsync).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
      });

      expect(mockExpoAudioSetAudioModeAsync).not.toHaveBeenCalled();
      expect(mockExpoAudioPrepareToRecordAsync).not.toHaveBeenCalled();
      expect(store.getState().allRecordings.recordings).toEqual([]);
      expect(screen.getByText(/No recordings yet/)).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByText('0:00')).toBeTruthy();
    });
  });

  it('saves the recording to the store and shows it in history', async () => {
    const { screen, store } = renderFlow();
    expect(screen.getByText(/No recordings yet/)).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('button', { name: 'Stop Recording' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
    });

    expect(store.getState().allRecordings.recordings).toEqual([
      {
        uri: 'file:///recordings/fallback.wav',
        date: 'Aug 8, 2026, 6:38 PM',
        duration: 2500,
        title: '',
        harmonySemitones: 4,
      },
    ]);
    expect(screen.queryByText(/No recordings yet/)).toBeNull();
    expect(screen.getByText('Aug 8, 2026, 6:38 PM')).toBeTruthy();
    expect(screen.getByPlaceholderText('Untitled Recording')).toBeTruthy();
    expect(screen.getByText('0:02')).toBeTruthy();
    expect(mockExpoAudioStop).toHaveBeenCalledTimes(1);
  });

  it('falls back to the elapsed timer when the recorder reports no duration', async () => {
    mockExpoAudioGetStatus.mockReturnValue({ durationMillis: undefined });
    mockExpoAudioRecorder.uri = 'file:///recordings/no-duration.wav';
    const { screen, store } = renderFlow();

    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
    });

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    fireEvent.press(screen.getByRole('button', { name: 'Stop Recording' }));
    await waitFor(() => {
      expect(store.getState().allRecordings.recordings).toHaveLength(1);
    });

    expect(store.getState().allRecordings.recordings[0]).toEqual({
      uri: 'file:///recordings/no-duration.wav',
      date: 'Aug 8, 2026, 6:38 PM',
      duration: 4000,
      title: '',
      harmonySemitones: 4,
    });
  });

  it('starts the timer on record and resets it on stop', async () => {
    const { screen } = renderFlow();
    expect(screen.getByText('0:00')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('0:00')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('0:03')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Stop Recording' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
    });

    expect(screen.queryByText('0:03')).toBeNull();
    expect(screen.getAllByText('0:00').length).toBeGreaterThanOrEqual(1);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('0:05')).toBeNull();
  });

  it('survives rapid start/stop taps without leaking recordings or corrupting history', async () => {
    mockExpoAudioRecorder.uri = 'file:///recordings/fallback.wav';
    const { screen, store } = renderFlow();
    const cycles = 3;

    for (let cycle = 0; cycle < cycles; cycle += 1) {
      const startButton = screen.getByRole('button', { name: 'Start Recording' });
      fireEvent.press(startButton);
      fireEvent.press(startButton);
      fireEvent.press(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
      });

      const stopButton = screen.getByRole('button', { name: 'Stop Recording' });
  mockExpoAudioRecorder.uri = `file:///recordings/fallback-${cycle + 1}.wav`;
      fireEvent.press(stopButton);
      fireEvent.press(stopButton);
      fireEvent.press(stopButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
      });
    }

    expect(mockExpoAudioPrepareToRecordAsync).toHaveBeenCalledTimes(cycles);
    expect(mockExpoAudioStop).toHaveBeenCalledTimes(cycles);
    const savedUris = store.getState().allRecordings.recordings.map((r) => r.uri);
    expect(savedUris).toEqual([
      'file:///recordings/fallback-1.wav',
      'file:///recordings/fallback-2.wav',
      'file:///recordings/fallback-3.wav',
    ]);
    expect(screen.getAllByPlaceholderText('Untitled Recording')).toHaveLength(cycles);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('0:05')).toBeNull();
  });

  it('guards against double taps delivered before the button re-renders', async () => {
    const { screen, store } = renderFlow();

    await act(async () => {
      const { onPress } = screen.UNSAFE_getByType(AppButton).props;
      onPress();
      onPress();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
    });
    expect(mockExpoAudioPrepareToRecordAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      const { onPress } = screen.UNSAFE_getByType(AppButton).props;
      onPress();
      onPress();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
    });
    expect(mockExpoAudioStop).toHaveBeenCalledTimes(1);
    expect(store.getState().allRecordings.recordings).toHaveLength(1);
  });

  it('recovers cleanly when the recorder fails to start', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockExpoAudioPrepareToRecordAsync.mockRejectedValueOnce(new Error('Recorder busy'));
    const { screen, store } = renderFlow();

    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to start recording:',
        expect.any(Error)
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('0:00')).toBeTruthy();
    expect(store.getState().allRecordings.recordings).toEqual([]);

    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
    });
    fireEvent.press(screen.getByRole('button', { name: 'Stop Recording' }));
    await waitFor(() => {
      expect(store.getState().allRecordings.recordings).toHaveLength(1);
    });

    consoleErrorSpy.mockRestore();
  });
});
