export interface Agent {
  id: string;
  name: string;
  masterId: string;
  status: "active" | "degraded" | "offline";
  battery: number;
  signal: number;
  zone: string;
  hardware: string;
  hardwareType?: string;
  firmware: string;
  capabilities: ("audio" | "video" | "motion" | "gps")[];
  position?: { lat: number; lng: number };
  lastSeen: string;
  cpuUsage: number;
  ramUsage: number;
  temp: number;
  audioLevel?: number;
  motionDetected?: boolean;
  streamUrl?: string;
  agentType?: "MOBILE" | "HARDWARE" | "AI" | "LEGACY";
}

export interface Master {
  id: string;
  name: string;
  status: "online" | "degraded" | "offline";
  agentCount: number;
  ip: string;
  uptime: string;
  cpuUsage: number;
  ramUsage: number;
  gps_lat?: number;
  gps_lng?: number;
}

export interface NodeData {
  nodeId: string;
  timestamp: string;
  motion: boolean;
  audioLevel: number;
  analogReading: number;
  position: { x: number; y: number };
  batteryLevel?: number;
  isActive: boolean;
  isMaster?: boolean;
}

export interface AudioClip {
  id: string;
  nodeIds: string[];
  startTimestamp: string;
  duration: number;
  audioUrl: string;
  triggerNodeId?: string;
  triggerValue?: number;
  labels?: string[];
}

export interface ThresholdEvent {
  timestamp: string;
  nodeId: string;
  value: number;
  clipId?: string;
}

export interface HistoricalDataPoint {
  time: string;
  timestamp: number;
  nodeA: number;
  nodeB: number;
  nodeC: number;
  motion: number;
  events: number;
  triangulation: {
    x: number;
    y: number;
    accuracy: number;
  };
}

export interface Position {
  x: number;
  y: number;
}

export interface TracePath {
  id: string;
  positions: Position[];
  timestamp: string;
}

export interface SystemStatus {
  status: "operational" | "degraded" | "critical";
  timestamp: string;
  agents: {
    total: number;
    active: number;
    offline: number;
    degraded: number;
  };
  masters: {
    total: number;
    online: number;
  };
  websocket_connections: number;
}

export interface SecurityEvent {
  id: string;
  type: "Intrusion" | "Audio Trigger" | "Unauthorized Access" | "System Anomaly";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  timestamp: string;
  zone: string;
  agentId?: string;
}

export interface TopologyData {
  nodes: any[];
  edges: any[];
}

export interface TopologySummary {
  totalNodes: number;
  totalEdges: number;
  avgSignal: number;
  weakestLink: string | null;
}

export interface RebalanceResult {
  movedAgents: number;
  success: boolean;
  message: string;
}

export interface OptimizeResult {
  optimizedRoutes: number;
  success: boolean;
  message: string;
}

export enum WebSocketMessageType {
  NODE_DATA = "NODE_DATA",
  THRESHOLD_ALERT = "THRESHOLD_ALERT",
  SYSTEM_STATUS = "SYSTEM_STATUS",
  NEW_CLIP = "NEW_CLIP",
  AGENT_STATUS = "AGENT_STATUS",
  MASTER_STATUS = "MASTER_STATUS",
  LIVE_FRAME = "LIVE_FRAME",
  TRANSCRIPTION_EVENT = "TRANSCRIPTION_EVENT",
  AUDIO_FRAME = "AUDIO_FRAME",
}

export interface WebSocketMessage<T> {
  type: WebSocketMessageType;
  data: T;
}
