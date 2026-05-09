/**
 * StreamManager — Singleton manager for video clip streaming using NISHA protocol.
 */

import { AppState, AppStateStatus } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { NISHAFrame, StreamType, Priority } from '../utils/protocol';
import { locationManager } from './LocationManager';
import { masterClient } from '../api/master_client';

// ---------- Types ----------

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface StreamStats {
  clipsSent: number;
  fps: number;
  latencyMs: number;
  bytesSent: number;
  connectionState: ConnectionState;
  errorMessage: string | null;
  isRecording: boolean;
}

export type StatsListener = (stats: StreamStats) => void;

export interface CaptureSource {
  captureFrame: () => Promise<string | null>;
  stopRecording: () => void;
  flipCamera?: () => void;
}

// ---------- Helpers ----------

// Helper to encode strings to Uint8Array (still used for metadata/location)
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// ---------- StreamManager ----------

const INITIAL_STATS: StreamStats = {
  clipsSent: 0,
  fps: 0,
  latencyMs: 0,
  bytesSent: 0,
  connectionState: 'disconnected',
  errorMessage: null,
  isRecording: false,
};

const MAX_BACKOFF_MS = 16_000;
const INITIAL_BACKOFF_MS = 1_000;
const CLIP_DURATION_SEC = 3;

class StreamManager {
  // Connection
  private ws: WebSocket | null = null;
  private wsUrl: string = '';
  private agentId: string = '';
  private captureSource: CaptureSource | null = null;
  private isConnecting = false;

  // State
  private _isStreaming = false;
  private _intentToStream = false;
  private stats: StreamStats = { ...INITIAL_STATS };
  private listeners: Set<StatsListener> = new Set();
  private sequence = 0;

  // Clip loop
  private clipIndex = 0;
  private loopActive = false;
  private bytesAccum = 0;

  // Backoff
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeMasterConnection: (() => void) | null = null;

  // AppState
  private appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;
  private wasStreamingBefore = false;

  // Location loop
  private locationInterval: ReturnType<typeof setInterval> | null = null;

  private videoEnabled = false;

  constructor() {
    this.appStateSub = AppState.addEventListener('change', this.onAppState);
  }

  // ---------- Public API ----------

  get isStreaming(): boolean { return this._isStreaming; }
  get currentStats(): StreamStats { return { ...this.stats }; }

  setVideoEnabled(enabled: boolean) {
    this.videoEnabled = enabled;
    if (enabled && this._isStreaming && !this.loopActive) {
      this.startFrameLoop();
    } else if (!enabled) {
      this.loopActive = false;
      this.captureSource?.stopRecording();
      this.emit({ isRecording: false });
    }
  }

  setCaptureSource(source: CaptureSource | null) {
    this.captureSource = source;
  }

  subscribe(listener: StatsListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStats);
    return () => this.listeners.delete(listener);
  }

  initialize(apiUrl?: string | null) {
      const inputUrl = apiUrl || process.env.EXPO_PUBLIC_MASTER_WS_URL || '';
      try {
          let parsedUrl = inputUrl;
          // Clean up any accidentally prepended http://ws:// or similar
          parsedUrl = parsedUrl.replace(/^(https?:\/\/)(wss?:\/\/)/, '$2');
          
          if (parsedUrl && !parsedUrl.startsWith('http') && !parsedUrl.startsWith('ws')) {
              parsedUrl = `http://${parsedUrl}`;
          }
          
          const urlObj = new URL(parsedUrl);
          
          // Dynamically determine protocol
          const isSecure = urlObj.protocol === 'https:' || urlObj.protocol === 'wss:';
          const protocol = isSecure ? 'wss:' : 'ws:';
          
          // Use provided port if present. If it's a local IP/localhost without a port, default to 8081.
          let hostAndPort = urlObj.host;
          if (!urlObj.port && (urlObj.hostname === 'localhost' || urlObj.hostname.match(/^[0-9.]+$/))) {
              hostAndPort = `${urlObj.hostname}:8081`;
          }
          
          this.wsUrl = `${protocol}//${hostAndPort}${urlObj.pathname}${urlObj.search}`;
          console.log("[StreamManager] Master URL verified as:", this.wsUrl);
      } catch (e) {
          console.warn("[StreamManager] URL parsing failed, falling back:", inputUrl);
          this.wsUrl = inputUrl.replace('http', 'ws').replace(':8080', ':8081');
      }
  }

  connect(agentId: string, _url?: string) {
    this.agentId = agentId;
    if (_url) this.initialize(_url);
    
    this._intentToStream = true;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.clearReconnect();
    
    // Disconnect old client if changing URLs or forcing reconnect
    if (masterClient.getConnectionState() !== 'disconnected') {
      masterClient.disconnect();
    }
    this.isConnecting = false;
    this.connectToMaster();
  }

  disconnect() {
    this._intentToStream = false;
    this.loopActive = false;
    this.clearReconnect();
    this.captureSource?.stopRecording();

    masterClient.disconnect();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    this._isStreaming = false;
    this.emit({ connectionState: 'disconnected', fps: 0, errorMessage: null, isRecording: false });
  }

  private audioBuffer: number[] = [];
  private readonly AUDIO_FLUSH_SIZE = 5120; // ~160ms of 16kHz 16-bit Mono PCM

  sendAudioStream(chunk: Uint8Array) {
    if (!this._isStreaming) return;
    
    // Accumulate in buffer
    for (let i = 0; i < chunk.length; i++) {
      this.audioBuffer.push(chunk[i]);
    }

    // Flush if we have enough for a packet
    if (this.audioBuffer.length >= this.AUDIO_FLUSH_SIZE) {
      const payload = new Uint8Array(this.audioBuffer);
      this.audioBuffer = [];

      this.sendFrame(
        StreamType.AUDIO,
        Priority.HIGH,
        -50,
        100,
        payload,
        { format: 'pcm_s16le', sampleRate: 16000 }
      );
    }
  }

  sendFrame(streamType: StreamType, priority: Priority, rssi: number, battery: number, payload: Uint8Array, extraMeta?: Record<string, unknown>) {
      const metadata = { agent_id: this.agentId, ...extraMeta };

      // Try to send via masterClient first
      if (masterClient.isConnected()) {
        const frame = NISHAFrame.encode(
            streamType,
            priority,
            this.sequence++,
            rssi,
            battery,
            payload,
            metadata
        );
        const success = masterClient.sendBinary(frame);
        // Only log periodically to avoid console flood
        if (success && streamType !== StreamType.VIDEO && streamType !== StreamType.AUDIO) {
            console.log(`[StreamManager] Sent ${StreamType[streamType]} frame`);
        }
        return success;
      }

      // Fallback to direct WebSocket if masterClient not available
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const frame = NISHAFrame.encode(
          streamType,
          priority,
          this.sequence++,
          rssi,
          battery,
          payload,
          metadata
      );

      try {
          this.ws.send(frame);
      } catch (e) {
          console.warn("[StreamManager] Send frame failed:", e);
      }
  }

  // ---------- Connection ----------

  private connectToMaster() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    // Clean up old WebSocket if exists
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.emit({ connectionState: 'connecting', errorMessage: null });

    console.log('[StreamManager] Connecting to Master at:', this.wsUrl);

    // Initialize master client if not already done
    masterClient.initialize({
      masterUrl: this.wsUrl,
      agentId: this.agentId,
      mode: 'AGENT',
      deviceInfo: {
        model: 'React Native Device',
        osVersion: 'Unknown',
        appVersion: '2.4.1',
      },
    }).then(() => {
      if (this.unsubscribeMasterConnection) {
        this.unsubscribeMasterConnection();
      }

      // Subscribe to connection state changes
      this.unsubscribeMasterConnection = masterClient.onConnectionStateChange((state) => {
        console.log('[StreamManager] Master connection state:', state);
        
        if (state === 'connected') {
          this.isConnecting = false;
          this.backoffMs = INITIAL_BACKOFF_MS;
          this._isStreaming = true;
          this.clipIndex = 0;
          this.bytesAccum = 0;
          this.emit({ connectionState: 'connected', clipsSent: 0, bytesSent: 0 });

          // Start location loop
          this.startLocationLoop();
          // Start frame loop
          this.startFrameLoop();
        } else if (state === 'connecting') {
          this.isConnecting = true;
          this.emit({ connectionState: 'connecting', errorMessage: null });
        } else if (state === 'disconnected') {
          this.isConnecting = false;
          this._isStreaming = false;
          this.loopActive = false;
          this.emit({ connectionState: 'disconnected', isRecording: false });
          // Trust masterClient to reconnect automatically
        } else if (state === 'error') {
          this.isConnecting = false;
          this.emit({ connectionState: 'error', errorMessage: 'Master connection error' });
          // Trust masterClient to reconnect automatically
        }
      });

      // Connect to master
      masterClient.connect();
    }).catch((error) => {
      console.error('[StreamManager] Failed to initialize master client:', error);
      this.isConnecting = false;
      this.emit({ connectionState: 'error', errorMessage: 'Connection setup failed' });
    });
  }

  private openConnection() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.emit({ connectionState: 'connecting', errorMessage: null });

    console.log('[StreamManager] Attempting connection to:', this.wsUrl);
    const ws = new WebSocket(this.wsUrl);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.isConnecting = false;
      console.log('[StreamManager] Connected. Sending ID:', this.agentId);
      ws.send(this.agentId);
      this.backoffMs = INITIAL_BACKOFF_MS;
      this._isStreaming = true;
      this.clipIndex = 0;
      this.bytesAccum = 0;
      this.emit({ connectionState: 'connected', clipsSent: 0, bytesSent: 0 });

      this.startLocationLoop();
      this.startFrameLoop();
    };

    ws.onerror = (err: any) => {
      this.isConnecting = false;
      console.error('[StreamManager] WS Error on', this.wsUrl, ':', err.message || JSON.stringify(err));
      this.emit({ connectionState: 'error', errorMessage: 'WebSocket error' });
    };

    ws.onclose = () => {
      this.stopLocationLoop();
      this.isConnecting = false;
      this._isStreaming = false;
      this.loopActive = false;
      this.emit({ connectionState: 'disconnected', isRecording: false });
      if (this._intentToStream) this.scheduleReconnect();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'flip_camera') {
          this.captureSource?.flipCamera?.();
        }
      } catch {}
    };
  }

  private startLocationLoop() {
    this.locationInterval = setInterval(() => {
      if (masterClient.isConnected()) {
        const gps = locationManager.coords;
        if (gps) {
          try {
            console.log('[StreamManager] Sending Location:', gps.lat.toFixed(6), gps.lng.toFixed(6));
            const payload = new TextEncoder().encode(JSON.stringify(gps));
            this.sendFrame(StreamType.LOCATION, Priority.LOW, -50, 100, payload);
          } catch (e) {}
        }
      }
    }, 2000);
  }

  private stopLocationLoop() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }

  private lastVideoFrameTime = 0;
  private readonly VIDEO_MIN_INTERVAL = 100; // ~10 FPS limit

  sendVideoFrame(videoBytes: Uint8Array) {
    if (!this._isStreaming || !this.videoEnabled) return;

    const now = Date.now();
    if (now - this.lastVideoFrameTime < this.VIDEO_MIN_INTERVAL) return;
    this.lastVideoFrameTime = now;

    // Send via NISHA protocol with raw RGB metadata
    this.sendFrame(
        StreamType.VIDEO,
        Priority.HIGH,
        -50, // rssi placeholder
        100, // battery placeholder
        videoBytes,
        { format: 'raw_rgb', width: 160, height: 120 }
    );
  }

  // ---------- Clip recording loop ----------

  private currentSessionId: string | null = null;

  private async startFrameLoop() {
    if (this.loopActive) return;
    this.loopActive = true;
    this.emit({ isRecording: true });
  }

  private stopFrameLoop() {
    this.loopActive = false;
    this.emit({ isRecording: false });
  }


  // ---------- Backoff ----------

  private scheduleReconnect() {
    this.clearReconnect();
    const delay = this.backoffMs;
    this.emit({
      connectionState: 'connecting',
      errorMessage: `Reconnecting in ${(delay / 1000).toFixed(0)}s...`,
    });
    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
      this.openConnection();
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ---------- AppState ----------

  private onAppState = (state: AppStateStatus) => {
    if (state === 'background' || state === 'inactive') {
      if (this._isStreaming || this._intentToStream) {
        this.wasStreamingBefore = true;
        this.loopActive = false;
        this.captureSource?.stopRecording();
        // Keep WebSocket open for telemetry/audio if possible, 
        // but for now we follow StreamCam's "disconnect on background" for video reliability
      }
    } else if (state === 'active') {
      if (this.wasStreamingBefore && this._intentToStream) {
        this.wasStreamingBefore = false;
        this.backoffMs = INITIAL_BACKOFF_MS;
        this.openConnection();
      }
    }
  };

  private emit(partial: Partial<StreamStats>) {
    this.stats = { ...this.stats, ...partial };
    const snap = { ...this.stats };
    for (const fn of this.listeners) {
      try { fn(snap); } catch {}
    }
  }
}

export const streamManager = new StreamManager();
