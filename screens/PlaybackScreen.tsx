import React, { useState, useRef, useCallback } from 'react';
import { View, FlatList, Text, Image } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useDispatch, useSelector } from 'react-redux';
import { delRec } from '../store/redux/recordings';
import { RootState } from '../store/redux/store';
import { Recording } from '../store/redux/recordings';
import styles from '../styles';
import PlaybackItem from '../components/PlaybackItem';

function PlaybackScreen() {
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const dispatch = useDispatch();
  const recordings = useSelector((state: RootState) => state.allRecordings.recordings);
  const player = useRef(new Audio.Sound());

  const handlePlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setCurrentPosition(status.positionMillis);
    if (status.didJustFinish) {
      setLoadedUri(null);
      setIsAudioPlaying(false);
      setCurrentPosition(0);
      player.current.unloadAsync().catch(() => null);
    }
  }, []);

  async function unloadPlayer() {
    try {
      const status = await player.current.getStatusAsync();
      if (status.isLoaded) {
        await player.current.stopAsync();
        await player.current.unloadAsync();
      }
    } catch {
      // player may already be unloaded
    }
    setLoadedUri(null);
    setIsAudioPlaying(false);
    setCurrentPosition(0);
  }

  async function playPauseAudio(uri: string) {
    try {
      // Tapping the currently loaded track
      if (loadedUri === uri) {
        const status = await player.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await player.current.pauseAsync();
            setIsAudioPlaying(false);
          } else {
            await player.current.playAsync();
            setIsAudioPlaying(true);
          }
        }
        return;
      }

      // Load a new track
      await unloadPlayer();
      await player.current.loadAsync({ uri }, {}, false);
      player.current.setOnPlaybackStatusUpdate(handlePlaybackStatus);
      await player.current.playAsync();
      setLoadedUri(uri);
      setIsAudioPlaying(true);
      setCurrentPosition(0);
    } catch (err) {
      console.error('Error playing audio:', err);
    }
  }

  async function seekAudio(uri: string, positionMillis: number) {
    if (loadedUri !== uri) return;
    try {
      await player.current.setPositionAsync(positionMillis);
      setCurrentPosition(positionMillis);
    } catch (err) {
      console.error('Error seeking audio:', err);
    }
  }

  async function deleteRecording(uri: string) {
    try {
      if (loadedUri === uri) {
        await unloadPlayer();
      }
      dispatch(delRec({ uri }));
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch (err) {
      console.error('Error deleting recording:', err);
    }
  }

  async function shareRecording(uri: string) {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) return;
      await Sharing.shareAsync(uri, {
        mimeType: 'audio/m4a',
        dialogTitle: 'Share your recording',
      });
    } catch (err) {
      console.error('Error sharing recording:', err);
    }
  }

  function renderItem({ item }: { item: Recording }) {
    const isThisItemPlaying = loadedUri === item.uri && isAudioPlaying;
    return (
      <PlaybackItem
        uri={item.uri}
        date={item.date}
        duration={item.duration}
        title={item.title}
        isPlaying={isThisItemPlaying}
        currentPosition={loadedUri === item.uri ? currentPosition : 0}
        onPlay={() => playPauseAudio(item.uri)}
        onDelete={() => deleteRecording(item.uri)}
        onSeek={(pos) => seekAudio(item.uri, pos)}
        onShare={() => shareRecording(item.uri)}
      />
    );
  }

  if (recordings.length === 0) {
    return (
      <View style={styles.container}>
        <Image source={require('../assets/logo.png')} style={styles.logoImage} />
        <Text style={styles.emptyStateText}>
          No recordings yet.{'\n'}Head to Record to get started!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={recordings}
        renderItem={renderItem}
        keyExtractor={(item) => item.uri}
        style={{ width: '100%' }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
      />
    </View>
  );
}

export default PlaybackScreen;