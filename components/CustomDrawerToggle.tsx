import React from 'react';
import { TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, DrawerActions } from '@react-navigation/native';

function CustomDrawerToggle() {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <Ionicons name="menu" size={28} color="#00ce0f" style={{ padding: 10 }} />
    </TouchableOpacity>
  );
}

export default CustomDrawerToggle;