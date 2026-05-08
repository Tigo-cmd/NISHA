/**
 * Mode Types & Capabilities
 */

export enum AppMode {
  AGENT = 'AGENT',
  MASTER = 'MASTER',
}

export type ModeStatus = 'UNSELECTED' | 'ACTIVE' | 'SWITCHING' | 'ERROR';

export interface ModeSwitchEvent {
  from: AppMode;
  to: AppMode;
  changedAt: string;
  reason: 'initial_selection' | 'user_request' | 'auto_fallback' | 'admin_command';
  childAgentsTransferred?: string[];
  newMasterId?: string;
}

export interface ModeConfig {
  mode: AppMode;
  selectedAt: string;
  canSwitch: boolean;
  switchHistory: ModeSwitchEvent[];
}

export interface ModeCapabilities {
  mode: AppMode;
  maxChildAgents: number;
  bufferSizeMB: number;
  heartbeatIntervalMs: number;
  batteryTargetPercentHour: number;
  canAggregate: boolean;
  canRelay: boolean;
  canAdvertise: boolean;
}

export const MODE_CAPABILITIES: Record<AppMode, ModeCapabilities> = {
  [AppMode.AGENT]: {
    mode: AppMode.AGENT,
    maxChildAgents: 0,
    bufferSizeMB: 50,
    heartbeatIntervalMs: 30000,
    batteryTargetPercentHour: 5,
    canAggregate: false,
    canRelay: false,
    canAdvertise: false,
  },
  [AppMode.MASTER]: {
    mode: AppMode.MASTER,
    maxChildAgents: 10,
    bufferSizeMB: 500,
    heartbeatIntervalMs: 5000,
    batteryTargetPercentHour: 15,
    canAggregate: true,
    canRelay: true,
    canAdvertise: true,
  },
};

export interface DetectionEvent {
  id: string;
  type: 'audio' | 'video' | 'location';
  subType: string; // gunshot, scream, motion, etc.
  confidence: number; // 0-100
  priority: 1 | 2 | 3; // 1=critical, 2=high, 3=normal
  timestamp: string;
  forwarded: boolean;
  forwardedTo?: string;
}

export interface ChildAgent {
  id: string;
  displayName: string;
  rssi: number;
  status: 'ACTIVE' | 'IDLE' | 'OFFLINE';
  audio: boolean;
  video: boolean;
  lastSeen: string;
  battery: number;
  connectedAt: string;
}
