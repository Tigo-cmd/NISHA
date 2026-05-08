import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useEffect } from 'react';
import { Audio } from 'expo-av';
import { COLORS } from '../src/config/theme';
import '../src/services/LocationManager'; // Register background task

export default function RootLayout() {
  useEffect(() => {
    // [ESP-Lite] Configure global audio mode for background support
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(err => console.warn('[RootLayout] Failed to set audio mode:', err));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg.default }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg.default },
          animation: 'fade',
        }}
      />
    </View>
  );
}
