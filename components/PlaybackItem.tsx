import React, { useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { useDispatch } from 'react-redux';
import { updateTitle } from '../store/redux/recordings';
import { formatTime } from '../utils/FormatTime';
import styles from '../styles';
import PlayPauseButton from './PlayPauseButton';
import TrashButton from './TrashButton';
import ShareButton from './ShareButton';

interface PlaybackItemProps {
  uri: string;
  date: string;
  duration: number;
  title: string;
  isPlaying: boolean;
  isLoading?: boolean;
  currentPosition: number;
  harmonyCaption?: string;
  onPlay: () => void;
  onDelete: () => void;
  onScrubStart: () => void;
  onSeek: (position: number) => void;
  onShare: () => void;
}

function PlaybackItem({
  uri,
  date,
  duration,
  title,
  isPlaying,
  isLoading = false,
  currentPosition,
  harmonyCaption,
  onPlay,
  onDelete,
  onScrubStart,
  onSeek,
  onShare,
}: PlaybackItemProps) {
  const dispatch = useDispatch();
  const [localTitle, setLocalTitle] = useState(title);
  // While dragging, the label follows the thumb in real time; the slider's
  // controlled value stays put so playback status updates can't fight the drag.
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);

  function handleSlidingStart(value: number) {
    setScrubPosition(value);
    onScrubStart();
  }

  function handleValueChange(value: number) {
    setScrubPosition((previous) => (previous === null ? previous : value));
  }

  function handleSlidingComplete(value: number) {
    setScrubPosition(null);
    onSeek(value);
  }

  function handleTitleSubmit() {
    const trimmed = localTitle.trim();
    dispatch(updateTitle({ uri, title: trimmed }));
  }

  return (
    <View style={styles.playbackContainer}>
      <View style={{ alignItems: 'center' }}>
        <TextInput
          placeholder="Untitled Recording"
          placeholderTextColor="#555"
          maxLength={40}
          style={styles.textInputText}
          value={localTitle}
          onChangeText={setLocalTitle}
          onBlur={handleTitleSubmit}
          onSubmitEditing={handleTitleSubmit}
          returnKeyType="done"
        />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.recordedText}>{date}</Text>
        {harmonyCaption ? <Text style={styles.recordedText}>{harmonyCaption}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.lengthText}>{formatTime(scrubPosition ?? currentPosition)}</Text>
        <Slider
          style={{ flex: 1, marginHorizontal: 10 }}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 1}
          value={currentPosition}
          onSlidingStart={handleSlidingStart}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
          accessibilityLabel="Playback position"
          minimumTrackTintColor="#FFFFFF"
          maximumTrackTintColor="#00000055"
          thumbTintColor="#FFFFFF"
        />
        <Text style={styles.lengthText}>{formatTime(duration)}</Text>
      </View>
      <View style={styles.playbackButtonContainer}>
        <PlayPauseButton onPress={onPlay} isPlaying={isPlaying} />
        {isLoading ? <ActivityIndicator color="black" accessibilityLabel="Preparing audio" /> : null}
        <ShareButton onPress={onShare} />
        <TrashButton onPress={onDelete} />
      </View>
    </View>
  );
}

export default PlaybackItem;