/**
 * Agent Store - Agent-specific state: connection, sensors, detections
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DetectionEvent } from '../types/mode';
import { audioManager } from '../services/AudioManager';
import { locationManager } from '../services/LocationManager';

export type MasterConnection = {
  masterId: string;
  masterName: string;
  rssi: number;
  connectedAt: string;
  latencyMs: number;
};

export type ConnectionStatus = 'CONNECTED' | 'SEARCHING' | 'ORPHAN' | 'DIRECT_SERVER' | 'UNSELECTED';

export type SensorState = {
  audio: boolean;
  video: boolean;
  location: boolean;
};

interface AgentState {
  agentId: string;
  status: ConnectionStatus;
  masterConnection: MasterConnection | null;
  availableMasters: MasterConnection[];
  sensors: SensorState;
  permissions: {
    audio: boolean | null;
    video: boolean | null;
    location: boolean | null;
  };
  detections: DetectionEvent[];
  battery: number;
  cameraFacing: 'front' | 'back';
  zoneName: string;
  hasHydrated: boolean;

  setAgentId: (id: string) => void;
  setHasHydrated: (val: boolean) => void;
  setStatus: (status: ConnectionStatus) => void;
  setMasterConnection: (master: MasterConnection | null) => void;
  setAvailableMasters: (masters: MasterConnection[]) => void;
  toggleSensor: (sensor: keyof SensorState) => Promise<void>;
  toggleCameraFacing: () => void;
  addDetection: (detection: DetectionEvent) => void;
  setBattery: (level: number) => void;
  clearDetections: () => void;
  initializeStreaming: (url: string) => Promise<void>;
  stopStreaming: () => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agentId: '',
      status: 'UNSELECTED',
      masterConnection: null,
      availableMasters: [],
      sensors: {
        audio: false,
        video: false,
        location: true,
      },
      permissions: {
        audio: null,
        video: null,
        location: null,
      },
      detections: [],
      battery: 100,
      cameraFacing: 'back',
      zoneName: 'Initial Zone',
      hasHydrated: false,

      setAgentId: (id: string) => set({ agentId: id }),
      setHasHydrated: (val: boolean) => set({ hasHydrated: val }),
      setStatus: (status: ConnectionStatus) => set({ status }),
      setMasterConnection: (master: MasterConnection | null) => set({ masterConnection: master }),
      setAvailableMasters: (masters: MasterConnection[]) => set({ availableMasters: masters }),

      toggleCameraFacing: () => set((state) => ({
        cameraFacing: state.cameraFacing === 'back' ? 'front' : 'back'
      })),

      toggleSensor: async (sensor: keyof SensorState) => {
        const state = get();
        const isEnabling = !state.sensors[sensor];

        // Lazy Permission Request
        if (isEnabling) {
          try {
            if (sensor === 'video') {
              const { Camera } = await import('expo-camera');
              const { status: camStatus } = await Camera.requestCameraPermissionsAsync();
              const { status: micStatus } = await Camera.requestMicrophonePermissionsAsync();
              if (camStatus !== 'granted' || micStatus !== 'granted') return;
            } else if (sensor === 'audio') {
              const { Audio } = await import('expo-av');
              const { status } = await Audio.requestPermissionsAsync();
              if (status !== 'granted') return;
            } else if (sensor === 'location') {
              const { requestForegroundPermissionsAsync } = await import('expo-location');
              const { status } = await requestForegroundPermissionsAsync();
              if (status !== 'granted') return;
            }
          } catch (e) {
            console.error("Permission request failed", e);
            return;
          }
        }

        set((state) => {
          const nextSensors = { ...state.sensors, [sensor]: !state.sensors[sensor] };

          // Action: Trigger actual managers
          if (sensor === 'audio') {
            nextSensors.audio ? audioManager.start() : audioManager.stop();
          } else if (sensor === 'location') {
            nextSensors.location ? locationManager.start() : locationManager.stop();
          } else if (sensor === 'video') {
            import('../services/StreamManager').then(m => {
               m.streamManager.setVideoEnabled(nextSensors.video);
            });
          }

          return { sensors: nextSensors };
        });
      },

      addDetection: (detection: DetectionEvent) =>
        set((state) => ({
          detections: [detection, ...state.detections].slice(0, 50),
        })),

      setBattery: (level: number) => set({ battery: level }),
      clearDetections: () => set({ detections: [] }),

      initializeStreaming: async (url: string) => {
        const { agentId, status } = get();
        if (!agentId || status === 'CONNECTED') return;

        const { streamManager } = await import('../services/StreamManager');
        streamManager.connect(agentId, url);
      },

      stopStreaming: async () => {
        const { streamManager } = await import('../services/StreamManager');
        const { audioManager } = await import('../services/AudioManager');
        const { locationManager } = await import('../services/LocationManager');
        
        streamManager.disconnect();
        audioManager.stop();
        locationManager.stop();
        
        set({ status: 'ORPHAN' });
      },
    }),
    {
      name: 'nisha-agent-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({ 
        agentId: state.agentId,
        sensors: state.sensors,
        zoneName: state.zoneName
      }),
    }
  )
);
