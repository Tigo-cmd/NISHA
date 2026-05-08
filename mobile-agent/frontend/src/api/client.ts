/**
 * API Client - Talks to FastAPI backend
 */

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_PREFIX = '/api/v1';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${BASE_URL}${API_PREFIX}${endpoint}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'POST', body }),
  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

// Endpoints
export interface RegisterResponse {
  agent_id: string;
  mode: string;
  config: {
    heartbeat_interval_ms: number;
    buffer_size_mb: number;
    max_children: number;
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';

async function getPersistentDeviceId() {
  let id = await AsyncStorage.getItem('NISHA_DEVICE_ID');
  if (!id) {
    // Simplified ID generation without external uuid library
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    id = `MOBILE-${randomPart}`;
    await AsyncStorage.setItem('NISHA_DEVICE_ID', id);
  }
  return id;
}

export async function registerAgent(
  mode: string,
  deviceInfo: { model: string; osVersion: string; appVersion: string }
): Promise<RegisterResponse> {
  const deviceId = await getPersistentDeviceId();
  return api.post<RegisterResponse>('/mobile/register', {
    agent_id: deviceId,
    phone_hash: deviceId,
    mode,
    device_info: deviceInfo,
  });
}

export async function sendHeartbeat(payload: {
  agent_id: string;
  mode: string;
  battery: number;
  master_id?: string | null;
  detection_count_24h?: number;
}) {
  return api.post('/mobile/heartbeat', payload);
}

export async function switchModeRemote(payload: {
  agent_id: string;
  new_mode: string;
  reason: string;
}) {
  return api.put('/mobile/mode', payload);
}

export async function fetchNetworkSnapshot() {
  return api.get<{
    total_agents: number;
    total_masters: number;
    active_agents: number;
    active_masters: number;
    recent_detections: Array<{
      id: string;
      subType: string;
      priority: number;
      timestamp: string;
    }>;
  }>('/network/snapshot');
}
