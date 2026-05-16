/**
 * Dynamic Network Configuration Manager
 * 
 * Allows switching between Cloudflare Tunnels (Remote) and Local LAN (Direct)
 * to minimize latency on home networks.
 */

const NETWORK_MODE = process.env.NEXT_PUBLIC_NETWORK_MODE || 'LOCAL'; // 'LOCAL' or 'TUNNEL'

// Backend Configuration
const BACKEND_LOCAL_IP = process.env.NEXT_PUBLIC_BACKEND_IP || '192.168.1.190';
const BACKEND_TUNNEL_HOST = 'api.buildwave.pro';

// Master Configuration (Optional, if dashboard needs direct Master access)
const MASTER_LOCAL_IP = process.env.NEXT_PUBLIC_MASTER_IP || '192.168.1.231';
const MASTER_TUNNEL_HOST = 'm01.buildwave.pro';

export const getBackendUrls = () => {
  if (NETWORK_MODE === 'LOCAL') {
    return {
      http: `http://${BACKEND_LOCAL_IP}:8000`,
      ws: `ws://${BACKEND_LOCAL_IP}:8000/api/v1/ws/realtime`
    };
  }
  return {
    http: `https://${BACKEND_TUNNEL_HOST}`,
    ws: `wss://${BACKEND_TUNNEL_HOST}/api/v1/ws/realtime`
  };
};

export const getMasterUrls = (masterId: string = 'm01') => {
  if (NETWORK_MODE === 'LOCAL') {
    return {
      http: `http://${MASTER_LOCAL_IP}:8080`,
      ws: `ws://${MASTER_LOCAL_IP}:8082`
    };
  }
  return {
    http: `https://${masterId}.buildwave.pro`,
    ws: `wss://${masterId}ws.buildwave.pro`
  };
};

export const config = {
  networkMode: NETWORK_MODE,
  backend: getBackendUrls(),
  master: getMasterUrls()
};
