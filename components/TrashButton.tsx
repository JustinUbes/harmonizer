import React from 'react';
import { TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface TrashButtonProps {
  onPress: () => void;
}

function TrashButton({ onPress }: TrashButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Delete recording"
    >
      <Ionicons name="trash-outline" size={28} color="black" />
    </TouchableOpacity>
  );
}

export default TrashButton;