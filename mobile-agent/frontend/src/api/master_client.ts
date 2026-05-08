/**
 * Master Client - WebSocket connection to Master node (port 8081)
 * Handles agent registration, handshake, and connection lifecycle
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type MasterConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MasterConnectionConfig {
  masterUrl: string;  // e.g., "ws://master:8081"
  agentId: string;
  mode: 'AGENT' | 'MASTER';
  deviceInfo: {
    model: string;
    osVersion: string;
    appVersion: string;
  };
}

export interface MasterHandshakePayload {
  type: 'HANDSHAKE';
  agent_id: string;
  mode: 'AGENT' | 'MASTER';
  device_info: {
    model: string;
    osVersion: string;
    appVersion: string;
  };
}

export interface MasterHeartbeatPayload {
  type: 'HEARTBEAT';
  agent_id: string;
  timestamp: string;
  battery: number;
  rssi: number;
}

export type MasterMessage = MasterHandshakePayload | MasterHeartbeatPayload | Record<string, unknown>;

export type MasterConnectionListener = (state: MasterConnectionState) => void;
export type MasterMessageListener = (message: MasterMessage) => void;

/**
 * MasterClient - Singleton WebSocket client for Master node connection
 */
class MasterClient {
  private ws: WebSocket | null = null;
  private config: MasterConnectionConfig | null = null;
  private connectionState: MasterConnectionState = 'disconnected';
  private connectionListeners: Set<MasterConnectionListener> = new Set();
  private messageListeners: Set<MasterMessageListener> = new Set();
  
  // Reconnection logic
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1000;
  private maxBackoffMs = 16000;
  private isIntentionallyClosed = false;

  // Heartbeat logic
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 30000;

  /**
   * Initialize master client configuration
   */
  async initialize(config: Partial<MasterConnectionConfig>) {
    if (!config.masterUrl) {
      throw new Error('masterUrl is required');
    }

    // Generate persistent agent ID if needed
    let agentId = config.agentId;
    if (!agentId) {
      agentId = await this.getPersistentAgentId();
    }

    this.config = {
      masterUrl: config.masterUrl,
      agentId,
      mode: config.mode || 'AGENT',
      deviceInfo: config.deviceInfo || {
        model: 'Unknown',
        osVersion: 'Unknown',
        appVersion: 'Unknown',
      },
    };

    console.log('[MasterClient] Initialized with config:', {
      masterUrl: this.config.masterUrl,
      agentId: this.config.agentId,
      mode: this.config.mode,
    });
  }

  /**
   * Get or create persistent agent ID
   */
  private async getPersistentAgentId(): Promise<string> {
    let id = await AsyncStorage.getItem('NISHA_MASTER_AGENT_ID');
    if (!id) {
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      id = `MOBILE-${randomPart}`;
      await AsyncStorage.setItem('NISHA_MASTER_AGENT_ID', id);
    }
    return id;
  }

  /**
   * Connect to master node
   */
  connect(): void {
    if (!this.config) {
      console.error('[MasterClient] Not initialized. Call initialize() first.');
      return;
    }

    if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
      console.warn('[MasterClient] Already connecting or connected');
      return;
    }

    this.isIntentionallyClosed = false;
    this.setConnectionState('connecting');
    this.openWebSocket();
  }

  /**
   * Disconnect from master node
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState('disconnected');
  }

  /**
   * Send message to master node
   */
  sendMessage(message: MasterMessage): boolean {
    if (this.connectionState !== 'connected' || !this.ws) {
      console.warn('[MasterClient] Not connected. Cannot send message:', message);
      return false;
    }

    try {
      const payload = JSON.stringify(message);
      this.ws.send(payload);
      console.log('[MasterClient] Message sent:', message.type || 'UNKNOWN');
      return true;
    } catch (error) {
      console.error('[MasterClient] Failed to send message:', error);
      return false;
    }
  }

  /**
   * Send binary data (for video/audio frames)
   */
  sendBinary(data: Uint8Array): boolean {
    if (this.connectionState !== 'connected' || !this.ws) {
      console.warn('[MasterClient] Not connected. Cannot send binary data');
      return false;
    }

    try {
      this.ws.send(data);
      return true;
    } catch (error) {
      console.error('[MasterClient] Failed to send binary data:', error);
      return false;
    }
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionStateChange(listener: MasterConnectionListener): () => void {
    this.connectionListeners.add(listener);
    // Immediately call with current state
    listener(this.connectionState);
    return () => this.connectionListeners.delete(listener);
  }

  /**
   * Subscribe to incoming messages
   */
  onMessage(listener: MasterMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): MasterConnectionState {
    return this.connectionState;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  // ===== Private Methods =====

  private openWebSocket(): void {
    if (!this.config) return;

    try {
      console.log('[MasterClient] Opening WebSocket to:', this.config.masterUrl);
      
      // Use native WebSocket for React Native/Expo
      // @ts-ignore - WebSocket is available in React Native
      this.ws = new WebSocket(this.config.masterUrl);
      
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => this.onWebSocketOpen();
      this.ws.onmessage = (event) => this.onWebSocketMessage(event);
      this.ws.onerror = (error) => this.onWebSocketError(error);
      this.ws.onclose = () => this.onWebSocketClose();
    } catch (error) {
      console.error('[MasterClient] Failed to open WebSocket:', error);
      this.setConnectionState('error');
      this.scheduleReconnect();
    }
  }

  private onWebSocketOpen(): void {
    console.log('[MasterClient] WebSocket opened');
    this.backoffMs = 1000; // Reset backoff on successful connection

    this.setConnectionState('connected');

    // Send handshake
    if (this.config) {
      const handshake: MasterHandshakePayload = {
        type: 'HANDSHAKE',
        agent_id: this.config.agentId,
        mode: this.config.mode,
        device_info: this.config.deviceInfo,
      };
      this.sendMessage(handshake);
    }

    // Start heartbeats
    this.startHeartbeat();
  }

  private onWebSocketMessage(event: WebSocketMessageEvent): void {
    try {
      if (typeof event.data === 'string') {
        // JSON message
        const message = JSON.parse(event.data) as MasterMessage;
        console.log('[MasterClient] Received message:', message.type || 'UNKNOWN');
        this.notifyMessageListeners(message);
      } else if (event.data instanceof ArrayBuffer) {
        // Binary data - pass as-is to listeners
        const binaryMessage: Record<string, unknown> = {
          type: 'BINARY_DATA',
          data: event.data,
        };
        this.notifyMessageListeners(binaryMessage);
      }
    } catch (error) {
      console.error('[MasterClient] Failed to parse message:', error);
    }
  }

  private onWebSocketError(error: WebSocketError): void {
    console.error('[MasterClient] WebSocket error:', error);
    this.setConnectionState('error');
  }

  private onWebSocketClose(): void {
    console.log('[MasterClient] WebSocket closed');
    this.ws = null;
    this.stopHeartbeat();

    if (!this.isIntentionallyClosed) {
      this.setConnectionState('disconnected');
      this.scheduleReconnect();
    } else {
      this.setConnectionState('disconnected');
    }
  }

  private setConnectionState(state: MasterConnectionState): void {
    if (this.connectionState === state) return;

    this.connectionState = state;
    console.log('[MasterClient] Connection state changed to:', state);
    this.notifyConnectionListeners();
  }

  private notifyConnectionListeners(): void {
    this.connectionListeners.forEach((listener) => {
      try {
        listener(this.connectionState);
      } catch (error) {
        console.error('[MasterClient] Error in connection listener:', error);
      }
    });
  }

  private notifyMessageListeners(message: MasterMessage): void {
    this.messageListeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        console.error('[MasterClient] Error in message listener:', error);
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected() && this.config) {
        const heartbeat: MasterHeartbeatPayload = {
          type: 'HEARTBEAT',
          agent_id: this.config.agentId,
          timestamp: new Date().toISOString(),
          battery: 100, // Placeholder
          rssi: -50,    // Placeholder
        };
        this.sendMessage(heartbeat);
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed) return;

    this.clearReconnectTimer();
    console.log(`[MasterClient] Scheduling reconnect in ${this.backoffMs}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      this.connect();
    }, this.backoffMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Export singleton instance
export const masterClient = new MasterClient();

// Type for WebSocket events (React Native compatibility)
interface WebSocketMessageEvent {
  data: string | ArrayBuffer;
}

interface WebSocketError {
  message: string;
  code?: number;
}
