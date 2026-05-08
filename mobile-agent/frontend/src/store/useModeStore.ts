import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { AppMode, ModeStatus } from '../types/mode';
import { registerAgent } from '../api/client';
import { useAgentStore } from './useAgentStore';

interface ModeState {
  mode: AppMode;
  status: ModeStatus;

  initializeAgent: () => Promise<void>;
  resetAgent: () => void;
}

/**
 * Simplified ModeStore for NISHA Mobile Agent.
 * Fixed to AGENT mode only.
 */
export const useModeStore = create<ModeState>()(
  persist(
    (set, get) => ({
      mode: AppMode.AGENT, // Force Agent mode
      status: 'UNSELECTED',

      initializeAgent: async () => {
        set({ status: 'SWITCHING' });
        try {
          // [ESP-Lite] Check if we already have a persistent ID
          let localId = useAgentStore.getState().agentId;
          
          if (!localId) {
            localId = `SENTINEL-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
            useAgentStore.getState().setAgentId(localId);
            console.log(`[ESP-Lite] Generated NEW persistent ID: ${localId}`);
          } else {
            console.log(`[ESP-Lite] Using EXISTING persistent ID: ${localId}`);
          }

          useAgentStore.getState().setStatus('DIRECT_SERVER');

          set({
            status: 'ACTIVE',
          });
        } catch (error) {
          console.error('Initialization failed:', error);
          set({ status: 'ERROR' });
        }
      },

      resetAgent: () => {
        set({ status: 'UNSELECTED' });
      },
    }),
    {
      name: 'nisha-mode-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
