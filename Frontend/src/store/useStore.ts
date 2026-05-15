import { create } from "zustand";
import type { Agent, Master, SystemStatus, SecurityEvent } from "@/types";

interface Alert {
    id: string;
    type: "AUDIO" | "VIDEO" | "SYSTEM";
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    timestamp: string;
    agentId: string;
    acknowledged: boolean;
}

interface SystemState {
    agents: Agent[];
    masters: Master[];
    alerts: Alert[];
    isHealthy: boolean;
    selectedAgentId: string | null;
    drawerOpen: boolean;
    systemStatus: SystemStatus | null;
    securityEvents: SecurityEvent[];
    threatLevel: "low" | "moderate" | "high" | "critical";
    telemetryLogs: any[];
    activeAudioAlert: any | null;

    setAgents: (agents: Agent[]) => void;
    setMasters: (masters: Master[]) => void;
    updateAgent: (agentId: string, updates: Partial<Agent>) => void;
    removeAgent: (agentId: string) => void;
    addAlert: (alert: Alert) => void;
    acknowledgeAlert: (alertId: string) => void;
    setSystemHealth: (isHealthy: boolean) => void;
    selectAgent: (agentId: string | null) => void;
    setDrawerOpen: (open: boolean) => void;
    setSystemStatus: (status: SystemStatus | null) => void;
    setSecurityEvents: (events: SecurityEvent[]) => void;
    setAlerts: (alerts: Alert[]) => void;
    clearAlerts: () => void;
    addSecurityEvent: (event: SecurityEvent) => void;
    clearSecurityEvents: () => void;
    setThreatLevel: (level: "low" | "moderate" | "high" | "critical") => void;
    addTelemetryLog: (log: any) => void;
    setActiveAudioAlert: (alert: any | null) => void;
}

export const useStore = create<SystemState>((set) => ({
    agents: [],
    masters: [],
    alerts: [],
    isHealthy: true,
    selectedAgentId: null,
    drawerOpen: false,
    systemStatus: null,
    securityEvents: [],
    threatLevel: "low",
    telemetryLogs: [],
    activeAudioAlert: null,

    setAgents: (agents) => set({ agents }),
    setMasters: (masters) => set({ masters }),

    updateAgent: (agentId, updates) => set((state) => ({
        agents: state.agents.map((agent) =>
            agent.id === agentId ? { ...agent, ...updates } : agent
        ),
    })),

    removeAgent: (agentId) => set((state) => ({
        agents: state.agents.filter((agent) => agent.id !== agentId),
    })),

    addAlert: (alert) => set((state) => ({
        alerts: [alert, ...state.alerts],
    })),

    setAlerts: (alerts) => set({ alerts }),
    clearAlerts: () => set({ alerts: [] }),
    setSecurityEvents: (securityEvents) => set({ securityEvents }),
    clearSecurityEvents: () => set({ securityEvents: [] }),

    acknowledgeAlert: (alertId) => set((state) => ({
        alerts: state.alerts.map((alert) =>
            alert.id === alertId ? { ...alert, acknowledged: true } : alert
        ),
    })),

    setSystemHealth: (isHealthy) => set({ isHealthy }),

    selectAgent: (agentId) => set({
        selectedAgentId: agentId,
        drawerOpen: agentId !== null,
    }),

    setDrawerOpen: (open) => set((state) => ({
        drawerOpen: open,
        selectedAgentId: open ? state.selectedAgentId : null,
    })),

    setSystemStatus: (status) => set({ systemStatus: status }),

    addSecurityEvent: (event) => set((state) => ({
        securityEvents: [event, ...state.securityEvents],
    })),

    setThreatLevel: (level) => set({ threatLevel: level }),

    addTelemetryLog: (log) => set((state) => ({
        telemetryLogs: [log, ...state.telemetryLogs].slice(0, 100),
    })),
    setActiveAudioAlert: (alert) => set({ activeAudioAlert: alert }),
}));
