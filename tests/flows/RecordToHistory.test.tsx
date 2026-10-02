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
const mockUsePermissions = jest.fn();

jest.mock('expo-av', () => ({
  Audio: {
    usePermissions: () => mockUsePermissions(),
    setAudioModeAsync: (...args: unknown[]) => mockSetAudioModeAsync(...args),
    Recording: {
      createAsync: (...args: unknown[]) => mockCreateAsync(...args),
    },
    RecordingOptionsPresets: {
      HIGH_QUALITY: 'HIGH_QUALITY',
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

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface MockPermissionResponse {
  status: PermissionStatus;
}

interface MockRecording {
  getStatusAsync: jest.Mock<Promise<{ durationMillis?: number }>, []>;
  stopAndUnloadAsync: jest.Mock<Promise<void>, []>;
  getURI: jest.Mock<string | null, []>;
}

function createMockRecording(uri: string, durationMillis?: number): MockRecording {
  return {
    getStatusAsync: jest.fn().mockResolvedValue({ durationMillis }),
    stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
    getURI: jest.fn().mockReturnValue(uri),
  };
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
  let createdRecordings: MockRecording[];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    createdRecordings = [];
    permissionResponse = { status: 'granted' };
    requestPermissionMock = jest.fn().mockResolvedValue({ status: 'granted' });
    mockUsePermissions.mockImplementation(() => [permissionResponse, requestPermissionMock]);
    mockSetAudioModeAsync.mockResolvedValue(undefined);
    mockCreateAsync.mockImplementation(async () => {
      const recording = createMockRecording(
        `file:///recordings/take-${createdRecordings.length + 1}.m4a`,
        2500
      );
      createdRecordings.push(recording);
      return { recording };
    });
  });

  afterEach(() => {
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  describe('microphone permission', () => {
    it('prompts for permission when undetermined and records once granted', async () => {
      permissionResponse.status = 'undetermined';
      const { screen, store } = renderFlow();

      fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
      });
      expect(requestPermissionMock).toHaveBeenCalledTimes(1);
      expect(mockCreateAsync).toHaveBeenCalledTimes(1);

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
      expect(requestPermissionMock).not.toHaveBeenCalled();
      expect(mockCreateAsync).toHaveBeenCalledWith('HIGH_QUALITY');
    });

    it('leaves the audio session and history untouched when permission is denied', async () => {
      permissionResponse.status = 'undetermined';
      requestPermissionMock.mockResolvedValue({ status: 'denied' });
      const { screen, store } = renderFlow();

      fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

      await waitFor(() => {
        expect(requestPermissionMock).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
      });

      expect(mockSetAudioModeAsync).not.toHaveBeenCalled();
      expect(mockCreateAsync).not.toHaveBeenCalled();
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
        uri: 'file:///recordings/take-1.m4a',
        date: 'Aug 8, 2026, 6:38 PM',
        duration: 2500,
        title: '',
      },
    ]);
    expect(screen.queryByText(/No recordings yet/)).toBeNull();
    expect(screen.getByText('Aug 8, 2026, 6:38 PM')).toBeTruthy();
    expect(screen.getByPlaceholderText('Untitled Recording')).toBeTruthy();
    expect(screen.getByText('0:02')).toBeTruthy();
    expect(createdRecordings[0].stopAndUnloadAsync).toHaveBeenCalledTimes(1);
  });

  it('falls back to the elapsed timer when the recorder reports no duration', async () => {
    mockCreateAsync.mockImplementationOnce(async () => {
      const recording = createMockRecording('file:///recordings/no-duration.m4a');
      createdRecordings.push(recording);
      return { recording };
    });
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
      uri: 'file:///recordings/no-duration.m4a',
      date: 'Aug 8, 2026, 6:38 PM',
      duration: 4000,
      title: '',
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
      fireEvent.press(stopButton);
      fireEvent.press(stopButton);
      fireEvent.press(stopButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
      });
    }

    expect(mockCreateAsync).toHaveBeenCalledTimes(cycles);
    expect(createdRecordings).toHaveLength(cycles);
    createdRecordings.forEach((recording) => {
      expect(recording.getStatusAsync).toHaveBeenCalledTimes(1);
      expect(recording.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
    });

    const savedUris = store.getState().allRecordings.recordings.map((r) => r.uri);
    expect(savedUris).toEqual([
      'file:///recordings/take-1.m4a',
      'file:///recordings/take-2.m4a',
      'file:///recordings/take-3.m4a',
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
    expect(mockCreateAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      const { onPress } = screen.UNSAFE_getByType(AppButton).props;
      onPress();
      onPress();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start Recording' })).toBeEnabled();
    });
    expect(createdRecordings).toHaveLength(1);
    expect(createdRecordings[0].stopAndUnloadAsync).toHaveBeenCalledTimes(1);
    expect(store.getState().allRecordings.recordings).toHaveLength(1);
  });

  it('recovers cleanly when the recorder fails to start', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCreateAsync.mockRejectedValueOnce(new Error('Recorder busy'));
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
