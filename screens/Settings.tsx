import React from 'react';
import { View, Text, Image, ScrollView, Alert } from 'react-native';
import styles from '../styles';
import AppButton from '../components/AppButton';
import { useDispatch, useSelector } from 'react-redux';
import { clearRec } from '../store/redux/recordings';
import { RootState } from '../store/redux/store';

function Settings() {
  const dispatch = useDispatch();
  const recordings = useSelector((state: RootState) => state.allRecordings.recordings);

  function clearAllRecordings() {
    Alert.alert(
      'Clear All Recordings',
      `This will permanently delete all ${recordings.length} recording${recordings.length !== 1 ? 's' : ''}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => dispatch(clearRec()),
        },
      ]
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { justifyContent: 'flex-start', paddingTop: 24, paddingBottom: 40 },
      ]}
    >
      <Image source={require('../assets/logo.png')} style={styles.logoImage} />

      <Text style={styles.sectionTitle}>Storage</Text>

      <View style={styles.settingsRow}>
        <Text style={styles.settingsLabel}>Total Recordings</Text>
        <Text style={styles.settingsLabel}>{recordings.length}</Text>
      </View>

      <View style={{ marginTop: 24, width: '90%' }}>
        <AppButton
          title="Clear All Recordings"
          onPress={clearAllRecordings}
          disabled={recordings.length === 0}
        />
      </View>

      <Text style={styles.versionText}>Harmonizer v1.0.0</Text>
    </ScrollView>
  );
}

export default Settings;