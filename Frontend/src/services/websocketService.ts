
import { WebSocketMessageType, WebSocketMessage } from '@/types';
// Mock toast for now
const toast = (props: any) => console.log('Toast:', props);

class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number = 1000;
  private listeners: Map<WebSocketMessageType, Array<(data: any) => void>> = new Map();

  constructor() {
    this.initializeListeners();
  }

  private initializeListeners() {
    for (const type in WebSocketMessageType) {
      this.listeners.set(WebSocketMessageType[type as keyof typeof WebSocketMessageType], []);
    }
  }

  public connect(url: string): void {
    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.reconnectAttempts = 0;
        toast({
          title: 'Connected',
          description: 'WebSocket connection established',
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // Handle both {type, data} and {type, ...data} formats
          const type = raw.type;
          const data = raw.data !== undefined ? raw.data : raw;
          
          if (type) {
            this.notifyListeners(type, data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.tryReconnect(url);
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.socket?.close();
      };
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error);
      this.tryReconnect(url);
    }
  }

  private tryReconnect(url: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      setTimeout(() => {
        this.connect(url);
      }, this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1));
    } else {
      console.error('Max reconnection attempts reached');
      toast({
        title: 'Connection Failed',
        description: 'Could not connect to the server after multiple attempts.',
        variant: 'destructive',
      });
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  public subscribe<T>(type: WebSocketMessageType, callback: (data: T) => void): () => void {
    const listeners = this.listeners.get(type) || [];
    listeners.push(callback);
    this.listeners.set(type, listeners);

    return () => {
      const updatedListeners = this.listeners.get(type)?.filter(listener => listener !== callback) || [];
      this.listeners.set(type, updatedListeners);
    };
  }

  private notifyListeners(type: WebSocketMessageType, data: any): void {
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in WebSocket listener for ${type}:`, error);
      }
    });
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  // Mock sending data (for development)
  public mockSend(type: WebSocketMessageType, data: any): void {
    this.notifyListeners(type, data);
  }
}

export const websocketService = new WebSocketService();
export default websocketService;
