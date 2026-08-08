import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';
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

function RecordScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedInterval, setSelectedInterval] =
    useState<HarmonyInterval>(DEFAULT_HARMONY_INTERVAL);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingActionInFlightRef = useRef(false);
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
      const permission =
        permissionResponse?.status === 'granted' ? permissionResponse : await requestPermission();

      if (!permission || permission.status !== 'granted') {
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('Failed to start recording:', err);
      setRecording(null);
      setIsRecording(false);
    } finally {
      recordingActionInFlightRef.current = false;
      setIsProcessing(false);
    }
  }

  async function stopRecording() {
    if (!recording || recordingActionInFlightRef.current) return;
    recordingActionInFlightRef.current = true;
    setIsRecording(false);
    setIsProcessing(true);
    try {
      const status = await recording.getStatusAsync();
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      resetTimer();

      const uri = recording.getURI();
      if (uri) {
        dispatch(
          addRec({
            uri,
            date: getCurrentDate(),
            duration: status.durationMillis ?? elapsedMs,
            title: '',
          })
        );
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
    } finally {
      setRecording(null);
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
