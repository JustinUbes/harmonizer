import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import {
  IOSOutputFormat,
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync as setExpoAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useDispatch } from 'react-redux';
import { addRec } from '../store/redux/recordings';
import { getCurrentDate } from '../utils/CurrentDate';
import {
  DEFAULT_HARMONY_INTERVAL,
  HARMONY_INTERVALS,
  HarmonyInterval,
} from '../utils/HarmonyIntervals';
import styles from '../styles';
import AppButton from '../components/AppButton';
import { formatTime } from '../utils/FormatTime';

const EXPO_AUDIO_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.wav',
  numberOfChannels: 1,
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    outputFormat: IOSOutputFormat.LINEARPCM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

function RecordScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedInterval, setSelectedInterval] =
    useState<HarmonyInterval>(DEFAULT_HARMONY_INTERVAL);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingActionInFlightRef = useRef(false);
  const expoAudioRecorder = useAudioRecorder(EXPO_AUDIO_RECORDING_OPTIONS);
  const dispatch = useDispatch();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  function startTimer() {
    if (timerRef.current === null) {
      timerRef.current = setInterval(() => {
        setElapsedMs((prev) => prev + 1000);
      }, 1000);
    }
  }

  function resetTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedMs(0);
  }

  async function startRecording() {
    if (recordingActionInFlightRef.current) return;
    recordingActionInFlightRef.current = true;
    setIsProcessing(true);

    try {
      let permission = await getRecordingPermissionsAsync();
      if (!permission.granted) {
        permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          return;
        }
      }


      await setExpoAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await expoAudioRecorder.prepareToRecordAsync(EXPO_AUDIO_RECORDING_OPTIONS);
      expoAudioRecorder.record();

      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('Failed to start recording:', err);
      setIsRecording(false);
    } finally {
      recordingActionInFlightRef.current = false;
      setIsProcessing(false);
    }
  }

  async function stopRecording() {
    if (recordingActionInFlightRef.current || !isRecording) return;
    recordingActionInFlightRef.current = true;
    setIsRecording(false);
    setIsProcessing(true);

    try {
      await expoAudioRecorder.stop();
      await setExpoAudioModeAsync({ allowsRecording: false });
      const recorderState = expoAudioRecorder.getStatus();
      const savedUri = expoAudioRecorder.uri;
      const savedDuration = recorderState.durationMillis ?? elapsedMs;

      resetTimer();

      if (savedUri) {
        dispatch(
          addRec({
            uri: savedUri,
            date: getCurrentDate(),
            duration: savedDuration,
            title: '',
            harmonySemitones: selectedInterval.semitones,
          })
        );
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
    } finally {
      recordingActionInFlightRef.current = false;
      setIsProcessing(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={require('../assets/turntable.png')} style={styles.turntable} />

      <Text style={styles.timerText}>{formatTime(elapsedMs)}</Text>

      <View style={{ alignItems: 'center' }}>
        <Text style={styles.harmonyLabel}>Harmony Interval</Text>
        <View style={styles.intervalContainer}>
          {HARMONY_INTERVALS.map((interval) => (
            <TouchableOpacity
              key={interval.label}
              style={[
                styles.intervalButton,
                selectedInterval.label === interval.label && styles.intervalButtonActive,
              ]}
              onPress={() => setSelectedInterval(interval)}
              disabled={isRecording || isProcessing}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedInterval.label === interval.label }}
            >
              <Text
                style={[
                  styles.intervalButtonText,
                  selectedInterval.label === interval.label && styles.intervalButtonTextActive,
                ]}
              >
                {interval.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <AppButton
        title={isRecording ? 'Stop Recording' : 'Start Recording'}
        onPress={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        loading={isProcessing}
      />
    </View>
  );
}

export default RecordScreen;
