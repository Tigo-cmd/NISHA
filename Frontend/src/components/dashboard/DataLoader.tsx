"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { apiService } from "@/services/apiService";
import { websocketService } from "@/services/websocketService";
import { WebSocketMessageType, Agent as StoreAgent, Master as StoreMaster } from "@/types";
import { config } from "@/lib/networkConfig";
import { toast } from "sonner";

// Maps backend Agent model to frontend StoreAgent model
const mapBackendAgent = (backendAgent: any): StoreAgent => {
  const id = (backendAgent.agent_id || backendAgent.short_id || "").toUpperCase();
  const isMac = /^[0-9A-Fa-f]{12}$/.test(id);
  const isNode = id.includes("NODE") || id.includes("ESP") || id.includes("CAM");
  
  const agentType = backendAgent.agent_type || 
                   (backendAgent.hardware_type === 'MOBILE' ? 'MOBILE' : 
                    (isMac || isNode) ? 'HARDWARE' : 'MOBILE');
                    
  return {
    id: backendAgent.agent_id || backendAgent.short_id,
    name: backendAgent.short_id || "Unknown",
    masterId: backendAgent.master_id || "",
    status: (backendAgent.status || "offline").toLowerCase() as any,
    battery: backendAgent.config?.battery_level || 100, // Mock fallback
    signal: backendAgent.config?.signal_strength || -50,
    zone: backendAgent.location_zone || "Unassigned",
    hardware: backendAgent.hardware_type || "Generic Agent",
    hardwareType: backendAgent.hardware_type,
    firmware: backendAgent.firmware_version || "v1.0.0",
    capabilities: Object.keys(backendAgent.capabilities || {}).filter(k => backendAgent.capabilities[k]) as StoreAgent['capabilities'],
    lastSeen: backendAgent.last_heartbeat ? new Date(backendAgent.last_heartbeat).toLocaleString() : "Never",
    cpuUsage: backendAgent.config?.cpu_usage_percent || 0,
    ramUsage: backendAgent.config?.free_heap_bytes ? Math.round(backendAgent.config.free_heap_bytes / 1024 / 1024 * 10) / 10 : 0, 
    temp: backendAgent.config?.temperature_c || 0,
    audioLevel: backendAgent.config?.current_db || 0,
    motionDetected: backendAgent.config?.motion_detected || false,
    streamUrl: backendAgent.stream_url,
    agentType: agentType,
    position: (backendAgent.gps_lat && backendAgent.gps_lng) ? {
      lat: backendAgent.gps_lat,
      lng: backendAgent.gps_lng
    } : undefined
  };
};

// Maps backend Master model to frontend StoreMaster model
const mapBackendMaster = (backendMaster: any): StoreMaster => {
  return {
    id: backendMaster.master_id,
    name: backendMaster.name || backendMaster.master_id,
    status: (backendMaster.status || "offline").toLowerCase() as any,
    agentCount: backendMaster.current_agent_count || 0,
    ip: backendMaster.ip_address || "0.0.0.0",
    uptime: backendMaster.last_seen ? new Date(backendMaster.last_seen).toLocaleString() : "Unknown",
    cpuUsage: 10, // Mock fallback
    ramUsage: 15,
    gps_lat: backendMaster.gps_lat, gps_lng: backendMaster.gps_lng
  };
};

export function DataLoader() {
  const setAgents = useStore((state) => state.setAgents);
  const setMasters = useStore((state) => state.setMasters);
  const setSystemStatus = useStore((state) => state.setSystemStatus);
  const setAlerts = useStore((state) => state.setAlerts);
  const setSecurityEvents = useStore((state) => state.setSecurityEvents);
  const updateAgent = useStore((state) => state.updateAgent);
  const addAlert = useStore((state) => state.addAlert);
  const addSecurityEvent = useStore((state) => state.addSecurityEvent);
  const setThreatLevel = useStore((state) => state.setThreatLevel);
  const addTelemetryLog = useStore((state) => state.addTelemetryLog);
  const clearAlerts = useStore((state) => state.clearAlerts);
  const clearSecurityEvents = useStore((state) => state.clearSecurityEvents);

  const pollInterval = useRef<NodeJS.Timeout | undefined>(undefined);

  const fetchData = async () => {
    try {
      const [agentsData, mastersData, systemStatus, audioEvents, videoEvents] = await Promise.all([
        apiService.getAgents(),
        apiService.getMasters(),
        apiService.getSystemStatus().catch(() => null),
        apiService.getAudioEvents(20).catch(() => []),
        apiService.getVideoEvents(20).catch(() => [])
      ]);

      if (agentsData && agentsData.length > 0) {
        const currentAgents = useStore.getState().agents;
        const mergedAgents = agentsData.map((backendAgent: any) => {
          const mapped = mapBackendAgent(backendAgent);
          const current = currentAgents.find(a => a.id === mapped.id);
          
          // Smart Merge: Don't downgrade to 'offline' if we think they are 'active' 
          // and we've seen them very recently (within 45s) via WebSockets.
          if (current && current.status === 'active' && mapped.status === 'offline') {
            const lastSeenDate = new Date(current.lastSeen);
            const now = new Date();
            if (now.getTime() - lastSeenDate.getTime() < 45000) {
              return { ...mapped, status: 'active', lastSeen: current.lastSeen };
            }
          }
          return mapped;
        });
        setAgents(mergedAgents);
      }

      if (mastersData && mastersData.length > 0) {
        setMasters(mastersData.map(mapBackendMaster));
      }

      if (systemStatus) {
        setSystemStatus(systemStatus);
      }

      // Process Alerts (Audio + Video)
      const currentAlerts = useStore.getState().alerts;
      const currentSecurityEvents = useStore.getState().securityEvents;

      const newAlerts: any[] = [];
      const newSecurityEvents: any[] = [];

      // Map Audio Events
      if (audioEvents && audioEvents.length > 0) {
        audioEvents.forEach((evt: any) => {
          if (!currentAlerts.some(a => a.id === evt.event_id)) {
            newAlerts.push({
              id: evt.event_id,
              type: "AUDIO",
              severity: (evt.priority === "1" ? "critical" : evt.priority === "2" ? "high" : "medium"),
              description: `Audio Event: ${evt.class_name.toUpperCase()}`,
              timestamp: new Date(evt.timestamp).toLocaleString(),
              agentId: evt.agent_id,
              acknowledged: evt.confirmed || false
            });
          }

          if (!currentSecurityEvents.some(e => e.id === evt.event_id)) {
            newSecurityEvents.push({
              id: evt.event_id,
              type: "Audio Trigger",
              severity: (evt.priority === "1" ? "critical" : evt.priority === "2" ? "high" : "medium"),
              description: `Audio Event: ${evt.class_name.toUpperCase()} (Confidence: ${(evt.confidence * 100).toFixed(1)}%)`,
              timestamp: new Date(evt.timestamp).toLocaleString(),
              zone: evt.location_zone || "Unknown",
              agentId: evt.agent_id
            });
          }
        });
      }

      // Map Video Events
      if (videoEvents && videoEvents.length > 0) {
        videoEvents.forEach((evt: any) => {
          if (!currentAlerts.some(a => a.id === evt.event_id)) {
            newAlerts.push({
              id: evt.event_id,
              type: "VIDEO",
              severity: (evt.priority === "1" ? "critical" : evt.priority === "2" ? "high" : "medium"),
              description: `Video Event: ${evt.behavior?.toUpperCase() || "MOTION"}`,
              timestamp: new Date(evt.timestamp).toLocaleString(),
              agentId: evt.agent_id,
              acknowledged: evt.confirmed || false
            });
          }

          if (!currentSecurityEvents.some(e => e.id === evt.event_id)) {
            newSecurityEvents.push({
              id: evt.event_id,
              type: "Video Analytics",
              severity: (evt.priority === "1" ? "critical" : evt.priority === "2" ? "high" : "medium"),
              description: `Behavior Detected: ${evt.behavior?.toUpperCase() || "MOTION"} (Confidence: ${(evt.confidence * 100).toFixed(1)}%)`,
              timestamp: new Date(evt.timestamp).toLocaleString(),
              zone: evt.location_zone || "Unknown",
              agentId: evt.agent_id
            });
          }
        });
      }

      /* Alerts Silenced per Request
      if (newAlerts.length > 0) {
        setAlerts([...newAlerts, ...currentAlerts].slice(0, 50));
      }
      if (newSecurityEvents.length > 0) {
        setSecurityEvents([...newSecurityEvents, ...currentSecurityEvents].slice(0, 50));
      }
      */

    } catch (error) {
      console.error("DataLoader error fetching live data:", error);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchData();
    clearAlerts();
    clearSecurityEvents();

    // Poll every 30 seconds for full sync (fallback for WebSockets)
    pollInterval.current = setInterval(fetchData, 30000);

    // WebSocket Connection
    let WS_URL = config.backend.ws;
    if (!WS_URL.includes('token=')) {
      WS_URL += "?token=NISHA-FRONTEND-DEV";
    }
    websocketService.connect(WS_URL);

    // Subscriptions
    const unsubNodeData = websocketService.subscribe(WebSocketMessageType.NODE_DATA, (data: any) => {
      // API_INTEGRATION_GUIDE.md: "Payload: Current battery, signal strength (dBm), CPU usage, and GPS coordinates."
      if (data && data.agent_id) {
        const hasGps = data.gps_lat !== undefined && data.gps_lat !== null && data.gps_lng !== undefined && data.gps_lng !== null;
        const gpsFragment = hasGps ? `LAT:${data.gps_lat.toFixed(5)} LNG:${data.gps_lng.toFixed(5)}` : "GPS:STABLE";
        
        addTelemetryLog({
          id: `tel-${Date.now()}-${data.agent_id}`,
          agentId: data.agent_id,
          type: "TELEMETRY",
          description: `Telemetry Received: ${gpsFragment} | BAT:${data.battery ?? 100}% SIG:${data.signal_strength ?? -50}dB`,
          timestamp: new Date().toISOString()
        });

        const updates: Partial<StoreAgent> = {
          battery: data.battery,
          signal: data.signal_strength,
          cpuUsage: data.cpu_usage,
          masterId: data.master_id,
          audioLevel: data.audio_level,
          lastSeen: new Date().toLocaleString(),
          // Force active: If we are receiving telemetry, the agent is alive.
          status: 'active'
        };

        if (hasGps) {
          updates.position = { lat: data.gps_lat, lng: data.gps_lng };
        }

        updateAgent(data.agent_id, updates);
      }
    });

    const unsubAlert = websocketService.subscribe(WebSocketMessageType.THRESHOLD_ALERT, (data: any) => {
      // API_INTEGRATION_GUIDE.md: "Payload: Alert ID, severity (critical/high), description, timestamp, agent ID."
      if (data) {
        // addAlert silenced per request

        // addSecurityEvent silenced per request

        if (data.severity === 'critical') setThreatLevel('critical');
        else if (data.severity === 'high' && useStore.getState().threatLevel !== 'critical') setThreatLevel('high');
      }
    });

    const unsubAudioAlert = websocketService.subscribe(WebSocketMessageType.AUDIO_ALERT_EVENT, (data: any) => {
      console.warn("🚨🚨🚨 AUDIO_ALERT_EVENT RECEIVED IN FRONTEND:", JSON.stringify(data));
      if (data && data.sound_class) {
        useStore.getState().setActiveAudioAlert(data);
        useStore.getState().setThreatLevel('critical');
        console.warn("🚨 ALERT SET IN STORE:", data.sound_class);
      }
    });

    const unsubSystem = websocketService.subscribe(WebSocketMessageType.SYSTEM_STATUS, (data: any) => {
      if (data) {
        setSystemStatus(data);
      }
    });

    const unsubNewClip = websocketService.subscribe(WebSocketMessageType.NEW_CLIP, (data: any) => {
      console.log("[DataLoader] New clip received, triggering refresh:", data);
      
      // Push to Terminal
      addTelemetryLog({
        id: `clip-${Date.now()}-${data.agent_id}`,
        agentId: data.agent_id,
        type: data.media_type === "audio" ? "AUDIO" : "VIDEO",
        description: `New ${data.media_type.toUpperCase()} Clip Captured & Persisted (10s)`,
        timestamp: new Date().toISOString()
      });

      fetchData();
    });

    const unsubAgentStatus = websocketService.subscribe(WebSocketMessageType.AGENT_STATUS, (data: any) => {
      console.log("[DataLoader] Agent status changed:", data);
      if (data && data.agent_id) {
        const newStatus = (data.payload?.new_status || data.payload?.status || "offline").toLowerCase();
        
        updateAgent(data.agent_id, {
          status: newStatus as any,
          lastSeen: new Date().toLocaleString()
        });

        addTelemetryLog({
          id: `status-${Date.now()}-${data.agent_id}`,
          agentId: data.agent_id,
          type: "SYSTEM",
          description: `Status Changed: ${newStatus.toUpperCase()} (${data.payload?.reason || "Heartbeat"})`,
          timestamp: new Date().toISOString()
        });
      }
    });

    const unsubMasterStatus = websocketService.subscribe(WebSocketMessageType.MASTER_STATUS, (data: any) => {
      console.log("[DataLoader] Master status changed:", data);
      if (data && data.master_id) {
        const newStatus = (data.payload?.status || "offline").toLowerCase();
        
        setMasters(useStore.getState().masters.map(m => 
          m.id === data.master_id ? { ...m, status: newStatus as any } : m
        ));

        addTelemetryLog({
          id: `master-${Date.now()}-${data.master_id}`,
          agentId: "SYSTEM",
          type: "SYSTEM",
          description: `Master ${data.payload?.name || data.master_id} is now ${newStatus.toUpperCase()}`,
          timestamp: new Date().toISOString()
        });
      }
    });

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
      unsubNodeData();
      unsubAlert();
      unsubAudioAlert();
      unsubSystem();
      unsubNewClip();
      unsubAgentStatus();
      unsubMasterStatus();
      websocketService.disconnect();
    };
  }, []);

  return null;
}
