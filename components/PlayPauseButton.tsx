import React from 'react';
import { TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface PlayPauseButtonProps {
  onPress: () => void;
  isPlaying: boolean;
}

function PlayPauseButton({ onPress, isPlaying }: PlayPauseButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
    >
      <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={32} color="black" />
    </TouchableOpacity>
  );
}

export default PlayPauseButton;