import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission, useCameraFormat, useFrameProcessor } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Worklets } from 'react-native-worklets-core';
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { streamManager } from '../services/StreamManager';

export interface HiddenCameraHandle {
  /** Capture the latest frame as raw RGB Uint8Array. */
  captureFrame: () => Promise<Uint8Array | null>;
  /** Cancel an in-progress recording (kept for compatibility). */
  stopRecording: () => void;
  /** Flip between front and back camera. */
  flipCamera: () => void;
  /** Current facing direction. */
  readonly facing: 'front' | 'back';
}

interface HiddenCameraProps {
  facing?: 'front' | 'back';
  audioEnabled?: boolean;
}

// Optimized dimensions for ultra-low latency raw transport
export const FRAME_WIDTH = 160;
export const FRAME_HEIGHT = 120;

export const HiddenCamera = forwardRef<HiddenCameraHandle, HiddenCameraProps>(
  ({ facing = 'back', audioEnabled = false }, ref) => {
    const { hasPermission: hasCamPermission, requestPermission: requestCamPermission } = useCameraPermission();
    const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();
    
    const [currentFacing, setCurrentFacing] = useState<'front' | 'back'>(facing);
    const device = useCameraDevice(currentFacing);
    const format = useCameraFormat(device, [
      { videoResolution: { width: 640, height: 480 } },
      { fps: 30 }
    ]);

    const latestFrame = useRef<Uint8Array | null>(null);
    const { resize } = useResizePlugin();

    useEffect(() => {
      if (!hasCamPermission) requestCamPermission();
      if (!hasMicPermission) requestMicPermission();
    }, [hasCamPermission, hasMicPermission]);

    // --- Video Bridge ---
    const sendVideoFrame = Worklets.createRunOnJS((data: Uint8Array) => {
      streamManager.sendVideoFrame(data);
    });

    const frameProcessor = useFrameProcessor((frame) => {
      'worklet';
      try {
        const result = resize(frame, {
          scale: { width: FRAME_WIDTH, height: FRAME_HEIGHT },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });
        // Bulk copy to prevent JSI garbage collection before async JS execution
        // This is 1000x faster than a JSI for-loop
        const copy = new Uint8Array(result);
        sendVideoFrame(copy);
      } catch (_e) {}
    }, [resize]);

    // --- Audio Bridge ---
    const sendAudioChunk = Worklets.createRunOnJS((data: Uint8Array) => {
      streamManager.sendAudioStream(data);
    });

    const onAudioFrame = useCallback((frame: any) => {
      'worklet';
      const buffer = frame.getUint8Array();
      const copy = new Uint8Array(buffer);
      sendAudioChunk(copy);
    }, []);

    const captureFrame = useCallback(async (): Promise<Uint8Array | null> => {
      return latestFrame.current;
    }, []);

    const stopRecording = useCallback(() => {}, []);

    const flipCamera = useCallback(() => {
      setCurrentFacing(f => f === 'back' ? 'front' : 'back');
    }, []);

    useImperativeHandle(ref, () => ({ captureFrame, stopRecording, flipCamera, get facing() { return currentFacing; } }), [
      captureFrame, stopRecording, flipCamera, currentFacing,
    ]);

    if (!hasCamPermission || !device) return null;

    return (
      <View style={styles.container}>
        <Camera
          style={styles.camera}
          device={device}
          format={format}
          isActive={true}
          frameProcessor={frameProcessor}
          audio={audioEnabled}
          onAudioFrame={onAudioFrame}
          pixelFormat="rgb"
        />
      </View>
    );
  },
);

HiddenCamera.displayName = 'HiddenCamera';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  camera: {
    width: 1,
    height: 1,
  },
});
