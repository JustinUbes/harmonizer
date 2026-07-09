import React from 'react';
import { TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface ShareButtonProps {
  onPress: () => void;
}

function ShareButton({ onPress }: ShareButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Share recording"
    >
      <Ionicons name="share-outline" size={28} color="black" />
    </TouchableOpacity>
  );
}

export default ShareButton;
