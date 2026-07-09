import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import styles from '../styles';

interface AppButtonProps {
  onPress: () => void;
  title: string;
  disabled?: boolean;
  loading?: boolean;
}

function AppButton({ onPress, title, disabled = false, loading = false }: AppButtonProps) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[styles.appButtonContainer, disabled && { opacity: 0.5 }]}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator color="black" />
      ) : (
        <Text style={styles.appButtonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export default AppButton;