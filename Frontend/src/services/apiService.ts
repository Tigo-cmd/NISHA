import {
  Agent,
  Master,
  NodeData,
  AudioClip,
  ThresholdEvent,
  SystemStatus,
  TopologyData,
  TopologySummary,
  RebalanceResult,
  OptimizeResult
} from '@/types';

// Mock toast for now
import { config } from '@/lib/networkConfig';

// Mock toast for now
const toast = (props: any) => console.log('Toast:', props);

// Base URL for API calls
const API_BASE_URL = config.backend.http;
const AGORA_TOKEN_URL = `${config.master.http}/api/agora/token`;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'nisha_master_key_2024_secure';

// Helper for authenticated fetch
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${API_KEY}`,
  };
  return fetch(url, { ...options, headers });
};

// Helper for handling API errors
const handleApiError = (error: any, message: string): never => {
  console.error(`API Error - ${message}:`, error);
  toast({
    title: 'API Error',
    description: message,
    variant: 'destructive',
  });
  throw error;
};

// Main API service
export const apiService = {
  // --- Agora ---
  async getAgoraToken(channelName: string, masterUrl?: string): Promise<{ token: string, appId: string }> {
    try {
      const baseUrl = masterUrl || AGORA_TOKEN_URL.replace('/api/agora/token', '');
      const response = await fetch(`${baseUrl}/api/agora/token?channelName=${channelName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, 'Failed to fetch Agora token');
    }
  },

  // --- Agents ---
  async getAgents(filters?: { status?: string; master_id?: string; location_zone?: string; offset?: number; limit?: number }): Promise<Agent[]> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) queryParams.append(key, String(value));
        });
      }
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/agents${queryString}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      return handleApiError(error, 'Failed to fetch agents');
    }
  },

  async getAgent(agentId: string): Promise<Agent | null> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/agents/${agentId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, `Failed to fetch agent ${agentId}`);
    }
  },

  async updateAgentConfig(agentId: string, config: any): Promise<any> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/agents/${agentId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, `Failed to update agent ${agentId} config`);
    }
  },

  async sendAgentCommand(agentId: string, commandType: string, params: any = {}): Promise<any> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/agents/${agentId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command_type: commandType, params, issued_by: "dashboard_user" })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, `Failed to send command to agent ${agentId}`);
    }
  },



  // --- Masters ---
  async getMasters(status?: string): Promise<Master[]> {
    try {
      const queryString = status ? `?status=${status}` : '';
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/masters${queryString}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      return handleApiError(error, 'Failed to fetch masters');
    }
  },

  async rebalanceMaster(masterId: string): Promise<RebalanceResult> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/masters/${masterId}/rebalance`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, `Failed to rebalance master ${masterId}`);
    }
  },

  // --- System ---
  async getSystemStatus(): Promise<SystemStatus | null> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/system/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, 'Failed to fetch system status');
    }
  },

  // --- Alerts / Events ---
  async getAudioEvents(limit: number = 20): Promise<any[]> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/audio/events?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, 'Failed to fetch audio events');
    }
  },

  async getVideoEvents(limit: number = 20): Promise<any[]> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/video/events?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, 'Failed to fetch video events');
    }
  },

  async getAgentLogs(agentId: string, limit: number = 50): Promise<any[]> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/agents/${agentId}/logs?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      return handleApiError(error, `Failed to fetch logs for agent ${agentId}`);
    }
  },

  async getAgentMedia(agentId: string, mediaType: 'video' | 'audio'): Promise<{base64?: string, error?: string} | null> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/agents/${agentId}/media/${mediaType}`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch media for agent ${agentId}`, error);
      return null;
    }
  },



  // --- Topology ---
  async getTopology(): Promise<TopologyData | null> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/topology`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, 'Failed to fetch topology');
    }
  },

  async getTopologySummary(): Promise<TopologySummary | null> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/topology/summary`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, 'Failed to fetch topology summary');
    }
  },

  async optimizeTopology(): Promise<OptimizeResult> {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/topology/optimize`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return handleApiError(error, 'Failed to optimize topology');
    }
  }
};
