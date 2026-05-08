/**
 * AudioManager — Singleton for independent audio clip streaming.
 */

import { Audio } from 'expo-av';
import { AppState, AppStateStatus } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { streamManager } from './StreamManager';
import { StreamType, Priority } from '../utils/protocol';

export type AudioConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AudioStats {
  clipsSent: number;
  bytesSent: number;
  connectionState: AudioConnectionState;
  isRecording: boolean;
  errorMessage: string | null;
}

export type AudioStatsListener = (stats: AudioStats) => void;

const INITIAL_STATS: AudioStats = {
  clipsSent: 0,
  bytesSent: 0,
  connectionState: 'disconnected',
  isRecording: false,
  errorMessage: null,
};

const AUDIO_CLIP_DURATION_MS = 2000; // 2 second clips for lower latency

// Compressed AAC recording options
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 22050,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 22050,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

function base64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

class AudioManager {
  private _isStreaming = false;
  private stats: AudioStats = { ...INITIAL_STATS };
  private listeners: Set<AudioStatsListener> = new Set();

  private clipIndex = 0;
  private loopActive = false;
  private bytesAccum = 0;

  private appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;
  private wasStreamingBefore = false;

  constructor() {
    this.appStateSub = AppState.addEventListener('change', this.onAppState);
  }

  get isStreaming(): boolean { return this._isStreaming; }
  get currentStats(): AudioStats { return { ...this.stats }; }

  subscribe(listener: AudioStatsListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStats);
    return () => this.listeners.delete(listener);
  }

  async start() {
    if (this._isStreaming) return;

    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      this.emit({ connectionState: 'error', errorMessage: 'Microphone permission denied' });
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true, // Keep recording in background
    });

    this._isStreaming = true;
    this.clipIndex = 0;
    this.bytesAccum = 0;
    this.emit({ connectionState: 'connected', clipsSent: 0, bytesSent: 0 });
    this.startAudioLoop();
  }

  stop() {
    this.loopActive = false;
    this._isStreaming = false;
    this.emit({ connectionState: 'disconnected', isRecording: false, errorMessage: null });
  }

  private currentSessionId: string | null = null;

  private async startAudioLoop() {
    if (this.loopActive) return;
    this.loopActive = true;
    
    // Create a unique session ID for this loop
    const sessionId = Math.random().toString(36).substring(7);
    this.currentSessionId = sessionId;

    while (this.loopActive && this._isStreaming && this.currentSessionId === sessionId) {
      let recording: Audio.Recording | null = null;
      try {
        this.emit({ isRecording: true });

        recording = new Audio.Recording();
        await recording.prepareToRecordAsync(RECORDING_OPTIONS);
        await recording.startAsync();

        // Wait for clip duration, but check periodically if we should stop
        const startTime = Date.now();
        while (Date.now() - startTime < AUDIO_CLIP_DURATION_MS) {
            if (!this.loopActive || !this._isStreaming || this.currentSessionId !== sessionId) break;
            await new Promise(r => setTimeout(r, 500));
        }

        if (!this.loopActive || !this._isStreaming || this.currentSessionId !== sessionId) {
            await recording.stopAndUnloadAsync();
            break;
        }

        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        recording = null;

        if (!uri) {
          this.emit({ isRecording: false });
          break;
        }

        const idx = this.clipIndex++;
        this.sendClipAsync(uri, idx);

      } catch (err) {
        console.warn('[AudioManager] Record error:', err);
        this.emit({ isRecording: false, errorMessage: String(err) });
        if (recording) {
          try { await recording.stopAndUnloadAsync(); } catch {}
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (this.currentSessionId === sessionId) {
        this.loopActive = false;
        this.emit({ isRecording: false });
    }
  }

  private async sendClipAsync(uri: string, index: number) {
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const audioBytes = base64ToBytes(b64);
      
      // Send via shared StreamManager using NISHA protocol
      streamManager.sendFrame(
          StreamType.AUDIO,
          Priority.HIGH,
          -50, // rssi placeholder
          100, // battery placeholder
          audioBytes,
          { format: 'aac' }
      );

      this.bytesAccum += audioBytes.byteLength;
      this.emit({ clipsSent: index + 1, bytesSent: this.bytesAccum });

      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (err) {
      console.warn('[AudioManager] Send error:', err);
    }
  }

  private onAppState = (state: AppStateStatus) => {
    // We keep audio streaming in background if staysActiveInBackground is true
    // but we can monitor state if needed.
  };

  private emit(partial: Partial<AudioStats>) {
    this.stats = { ...this.stats, ...partial };
    const snap = { ...this.stats };
    for (const fn of this.listeners) {
      try { fn(snap); } catch {}
    }
  }
}

export const audioManager = new AudioManager();
