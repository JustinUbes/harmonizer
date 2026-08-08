import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import RecordScreen from '../../screens/RecordScreen';
import { addRec } from '../../store/redux/recordings';

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
    mockUsePermissions.mockImplementation(() => [permissionResponse, requestPermissionMock]);
    mockSetAudioModeAsync.mockResolvedValue(undefined);
    mockCreateAsync.mockResolvedValue({ recording: createMockRecording() });
  });

  afterEach(() => {
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  it('requests permission and does not start recording when permission is denied', async () => {
    permissionResponse = { status: 'denied' };
    requestPermissionMock.mockResolvedValue({ status: 'denied' });

    const screen = render(<RecordScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

    await waitFor(() => {
      expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateAsync).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start Recording' })).toBeTruthy();
  });

  it('starts the timer, dispatches the saved recording payload, and resets on stop', async () => {
    const mockRecording = createMockRecording();
    mockCreateAsync.mockResolvedValue({ recording: mockRecording });

    const screen = render(<RecordScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

    await waitFor(() => {
      expect(mockCreateAsync).toHaveBeenCalledWith('HIGH_QUALITY');
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByText('0:02')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Stop Recording' }));

    await waitFor(() => {
      expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      addRec({
        uri: 'file:///recordings/test.m4a',
        date: 'Aug 8, 2026, 6:38 PM',
        duration: 2500,
        title: '',
      })
    );
    expect(mockSetAudioModeAsync).toHaveBeenNthCalledWith(1, {
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    expect(mockSetAudioModeAsync).toHaveBeenNthCalledWith(2, {
      allowsRecordingIOS: false,
    });
    expect(screen.getByText('0:00')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Recording' })).toBeTruthy();
  });

  it('ignores rapid repeated taps while recording startup is still in flight', async () => {
    const startDeferred = deferredPromise<{ recording: MockRecording }>();
    mockCreateAsync.mockReturnValue(startDeferred.promise);

    const screen = render(<RecordScreen />);
    const startButton = screen.getByRole('button', { name: 'Start Recording' });

    fireEvent.press(startButton);
    fireEvent.press(startButton);

    await waitFor(() => {
      expect(mockCreateAsync).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      startDeferred.resolve({ recording: createMockRecording() });
      await startDeferred.promise;
    });

    expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
  });

  it('ignores rapid repeated taps while stopping a recording', async () => {
    const stopDeferred = deferredPromise<void>();
    const mockRecording = createMockRecording({
      stopAndUnloadAsync: jest.fn().mockReturnValue(stopDeferred.promise),
    });
    mockCreateAsync.mockResolvedValue({ recording: mockRecording });

    const screen = render(<RecordScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Start Recording' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop Recording' })).toBeTruthy();
    });

    const stopButton = screen.getByRole('button', { name: 'Stop Recording' });
    fireEvent.press(stopButton);
    fireEvent.press(stopButton);

    await waitFor(() => {
      expect(mockRecording.getStatusAsync).toHaveBeenCalledTimes(1);
      expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      stopDeferred.resolve();
      await stopDeferred.promise;
    });

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledTimes(1);
    });
  });
});
