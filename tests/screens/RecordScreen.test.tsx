import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import RecordScreen from '../../screens/RecordScreen';
import { addRec } from '../../store/redux/recordings';
import { HARMONY_INTERVALS } from '../../utils/HarmonyIntervals';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'Light',
  },
}));

jest.mock('../../utils/CurrentDate', () => ({
  getCurrentDate: jest.fn(() => 'Aug 8, 2026, 6:38 PM'),
}));

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
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
        isMeteringEnabled: true,
        android: { extension: '.m4a' },
        ios: { extension: '.m4a', outputFormat: 'aac ' },
        web: {},
      },
    },
    IOSOutputFormat: {
      LINEARPCM: 'lpcm',
    },
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

interface MockRecording {
  getStatusAsync: jest.Mock<Promise<{ durationMillis?: number }>, []>;
  stopAndUnloadAsync: jest.Mock<Promise<void>, []>;
  getURI: jest.Mock<string | null, []>;
}

function deferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function createMockRecording(
  overrides: Partial<MockRecording> = {}
): MockRecording {
  return {
    getStatusAsync: jest.fn().mockResolvedValue({ durationMillis: 2500 }),
    stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
    getURI: jest.fn().mockReturnValue('file:///recordings/test.m4a'),
    ...overrides,
  };
}

describe('RecordScreen', () => {
  let permissionResponse: MockPermissionResponse;
  let requestPermissionMock: jest.Mock<Promise<MockPermissionResponse>, []>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    permissionResponse = { status: 'granted' };
    requestPermissionMock = jest.fn().mockResolvedValue(permissionResponse);
    mockRequestPermissionsAsync.mockImplementation(() => requestPermissionMock());
    mockGetPermissionsAsync.mockResolvedValue(permissionResponse);
    mockExpoAudioGetRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    mockExpoAudioRequestPermissionsAsync.mockResolvedValue({ granted: true });
    mockExpoAudioSetAudioModeAsync.mockResolvedValue(undefined);
    mockExpoAudioPrepareToRecordAsync.mockResolvedValue(undefined);
    mockExpoAudioRecord.mockReturnValue(undefined);
    mockExpoAudioStop.mockResolvedValue(undefined);
    mockExpoAudioGetStatus.mockReturnValue({ durationMillis: 2500 });
    mockSetAudioModeAsync.mockResolvedValue(undefined);
    mockCreateAsync.mockResolvedValue({ recording: createMockRecording() });
  });

  afterEach(() => {
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  it('renders every harmony interval with Major 3rd selected by default', () => {
    const screen = render(<RecordScreen />);

    HARMONY_INTERVALS.forEach(({ label }) => {
      expect(screen.getByRole('radio', { name: label })).toBeTruthy();
    });
    expect(screen.getByRole('radio', { name: 'Major 3rd' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Minor 3rd' })).not.toBeSelected();
  });

  it('updates the selected harmony interval when another interval is pressed', () => {
    const screen = render(<RecordScreen />);

    fireEvent.press(screen.getByRole('radio', { name: 'Perfect 5th' }));

    expect(screen.getByRole('radio', { name: 'Perfect 5th' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Major 3rd' })).not.toBeSelected();
  });

  it('disables harmony interval selection while recording', async () => {
    const screen = render(<RecordScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
    });

    HARMONY_INTERVALS.forEach(({ label }) => {
      expect(screen.getByRole('radio', { name: label })).toBeDisabled();
    });
    fireEvent.press(screen.getByRole('radio', { name: 'Octave' }));
    expect(screen.getByRole('radio', { name: 'Major 3rd' })).toBeSelected();
  });

  it('requests permission and does not start recording when permission is denied', async () => {
    mockExpoAudioGetRecordingPermissionsAsync.mockResolvedValue({ granted: false });
    mockExpoAudioRequestPermissionsAsync.mockResolvedValue({ granted: false });

    const screen = render(<RecordScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

    await waitFor(() => {
      expect(mockExpoAudioRequestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockExpoAudioPrepareToRecordAsync).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start Recording' })).toBeTruthy();
  });

  it('starts the timer, dispatches the saved recording payload, and resets on stop', async () => {
    const screen = render(<RecordScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

    await waitFor(() => {
      expect(mockExpoAudioPrepareToRecordAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: '.wav',
          numberOfChannels: 1,
          ios: expect.objectContaining({
            outputFormat: 'lpcm',
            linearPCMBitDepth: 16,
          }),
        })
      );
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByText('0:02')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Stop Recording' }));

    await waitFor(() => {
      expect(mockExpoAudioStop).toHaveBeenCalledTimes(1);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      addRec({
        uri: 'file:///recordings/fallback.wav',
        date: 'Aug 8, 2026, 6:38 PM',
        duration: 2500,
        title: '',
        harmonySemitones: 4,
      })
    );
    expect(mockExpoAudioSetAudioModeAsync).toHaveBeenNthCalledWith(1, {
      allowsRecording: true,
      playsInSilentMode: true,
    });
    expect(mockExpoAudioSetAudioModeAsync).toHaveBeenNthCalledWith(2, {
      allowsRecording: false,
    });
    expect(screen.getByText('0:00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Recording' })).toBeTruthy();
  });

  it('ignores rapid repeated taps while recording startup is still in flight', async () => {
    const startDeferred = deferredPromise<void>();
    mockExpoAudioPrepareToRecordAsync.mockReturnValue(startDeferred.promise);

    const screen = render(<RecordScreen />);
    const startButton = screen.getByRole('button', { name: 'Start Recording' });

    fireEvent.press(startButton);
    fireEvent.press(startButton);

    await waitFor(() => {
      expect(mockExpoAudioPrepareToRecordAsync).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      startDeferred.resolve();
      await startDeferred.promise;
    });

    expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
  });

  it('ignores rapid repeated taps while stopping a recording', async () => {
    const stopDeferred = deferredPromise<void>();
    mockExpoAudioStop.mockReturnValue(stopDeferred.promise);

    const screen = render(<RecordScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop Recording' });
    fireEvent.press(stopButton);
    fireEvent.press(stopButton);

    await waitFor(() => {
      expect(mockExpoAudioStop).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      stopDeferred.resolve();
      await stopDeferred.promise;
    });

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledTimes(1);
    });
  });

  it('saves the selected harmony interval with the recording', async () => {
    const screen = render(<RecordScreen />);

    fireEvent.press(screen.getByRole('radio', { name: 'Perfect 5th' }));
    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
    });
    fireEvent.press(screen.getByRole('button', { name: 'Stop Recording' }));

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        addRec(expect.objectContaining({ harmonySemitones: 7 }))
      );
    });
  });
});
