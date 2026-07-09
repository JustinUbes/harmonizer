import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
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
  currentPosition: number;
  onPlay: () => void;
  onDelete: () => void;
  onSeek: (position: number) => void;
  onShare: () => void;
}

function PlaybackItem({
  uri,
  date,
  duration,
  title,
  isPlaying,
  currentPosition,
  onPlay,
  onDelete,
  onSeek,
  onShare,
}: PlaybackItemProps) {
  const dispatch = useDispatch();
  const [localTitle, setLocalTitle] = useState(title);

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
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.lengthText}>{formatTime(currentPosition)}</Text>
        <Slider
          style={{ flex: 1, marginHorizontal: 10 }}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 1}
          value={currentPosition}
          onSlidingComplete={onSeek}
          minimumTrackTintColor="#FFFFFF"
          maximumTrackTintColor="#00000055"
          thumbTintColor="#FFFFFF"
        />
        <Text style={styles.lengthText}>{formatTime(duration)}</Text>
      </View>
      <View style={styles.playbackButtonContainer}>
        <PlayPauseButton onPress={onPlay} isPlaying={isPlaying} />
        <ShareButton onPress={onShare} />
        <TrashButton onPress={onDelete} />
      </View>
    </View>
  );
}

export default PlaybackItem;