import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACING } from '../src/config/theme';
import { useAgentStore } from '../src/store/useAgentStore';
import { useModeStore } from '../src/store/useModeStore';
import { MeshVisualizer } from '../src/components/MeshVisualizer';
import { TopBar } from '../src/components/TopBar';
import { Card } from '../src/components/Card';
import { SensorRow } from '../src/components/SensorRow';
import { DetectionRow } from '../src/components/DetectionRow';
import { StatusDot } from '../src/components/StatusDot';
import { BottomNav } from '../src/components/BottomNav';
import { HiddenCamera, HiddenCameraHandle } from '../src/components/HiddenCamera';
import { ConfigOverlay } from '../src/components/ConfigOverlay';
import { streamManager, StreamStats } from '../src/services/StreamManager';
import { audioManager } from '../src/services/AudioManager';
import { locationManager } from '../src/services/LocationManager';

export default function AgentDashboard() {
  const router = useRouter();
  const cameraRef = useRef<HiddenCameraHandle>(null);
  
  const {
    agentId,
    status,
    masterConnection,
    sensors,
    detections,
    battery,
    zoneName,
    hasHydrated,
    toggleSensor,
    initializeStreaming,
  } = useAgentStore();

  const [vStats, setVStats] = useState<StreamStats>(streamManager.currentStats);
  const refreshing = useRef(false);

  useEffect(() => {
    if (hasHydrated && status === 'UNSELECTED') {
      useModeStore.getState().initializeAgent();
    }
  }, [status, hasHydrated]);

  useEffect(() => {
    // [ESP-Lite] Auto-connect to master when in DIRECT_SERVER mode
    if (agentId && (status === 'DIRECT_SERVER' || status === 'ORPHAN')) {
      const wsUrl = process.env.EXPO_PUBLIC_MASTER_WS_URL || 'ws://10.0.2.2:8081';
      initializeStreaming(wsUrl);
    }
  }, [agentId, status]);

  useEffect(() => {
    // [ESP-Lite] Resume sensor managers if enabled on hydration
    if (hasHydrated) {
      if (sensors.audio) {
        audioManager.start();
      }
      if (sensors.location) {
        locationManager.start();
      }
      streamManager.setVideoEnabled(sensors.video);
    }
  }, [hasHydrated]);

  useEffect(() => {
    // Wire up camera to stream manager
    streamManager.setCaptureSource(cameraRef.current);
    
    // Subscribe to stats
    const unsub = streamManager.subscribe(setVStats);
    return unsub;
  }, [cameraRef.current]);

  const onRefresh = () => {
    refreshing.current = true;
    setTimeout(() => {
      refreshing.current = false;
    }, 1000);
  };

  const statusLabel =
    status === 'CONNECTED' ? 'LIVE' :
    status === 'SEARCHING' ? 'CONNECTING' :
    status === 'ORPHAN' ? 'ORPHAN' : 'OFFLINE';

  const statusColor =
    status === 'CONNECTED' ? COLORS.status.success :
    status === 'SEARCHING' ? COLORS.status.warning :
    status === 'ORPHAN' ? COLORS.status.danger : COLORS.text.muted;

  return (
    <View style={styles.root}>
      <HiddenCamera 
        ref={cameraRef} 
        audioEnabled={sensors.audio}
      />
      <ConfigOverlay />
      
      <SafeAreaView edges={['top']}>
        <TopBar
          battery={battery}
          masterName={masterConnection?.masterName}
          label="SENTINEL"
        />
      </SafeAreaView>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing.current}
            onRefresh={onRefresh}
            tintColor={COLORS.agent.primary}
          />
        }
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroSection}>
          <MeshVisualizer mode="AGENT" size={180} active={status === 'CONNECTED'} />
          <View style={styles.statusBlock}>
            <View style={styles.statusRow}>
              <StatusDot color={statusColor} size={8} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
            <Text style={styles.agentIdText}>{agentId || 'UNINITIALIZED'}</Text>
          </View>
        </View>

        {/* Live Stats */}
        {status === 'CONNECTED' && (
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{vStats.clipsSent}</Text>
              <Text style={styles.statLabel}>CLIPS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{(vStats.latencyMs / 1000).toFixed(1)}s</Text>
              <Text style={styles.statLabel}>LATENCY</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{(vStats.bytesSent / 1024).toFixed(0)}K</Text>
              <Text style={styles.statLabel}>SENT</Text>
            </View>
          </View>
        )}

        {/* Sensors */}
        <Card title="SENSORS" variant="agent" style={styles.section}>
          <View style={styles.sensorHeader}>
            <Text style={styles.sensorCardSub}>HARDWARE INTERFACE</Text>
            <TouchableOpacity
              style={styles.flipBtn}
              onPress={() => cameraRef.current?.flipCamera()}
            >
              <Ionicons name="camera-reverse-outline" size={16} color={COLORS.agent.primary} />
              <Text style={styles.flipText}>FLIP CAM</Text>
            </TouchableOpacity>
          </View>

          <SensorRow
            type="audio"
            active={sensors.audio}
            onToggle={() => toggleSensor('audio')}
            statusText={sensors.audio ? 'LISTENING' : 'MUTED'}
            mode="AGENT"
          />
          <View style={styles.sensorDivider} />
          <SensorRow
            type="video"
            active={sensors.video}
            onToggle={() => toggleSensor('video')}
            statusText={sensors.video ? (vStats.isRecording ? 'RECORDING' : 'IDLE') : 'OFFLINE'}
            mode="AGENT"
          />
          <View style={styles.sensorDivider} />
          <SensorRow
            type="location"
            active={sensors.location}
            onToggle={() => toggleSensor('location')}
            statusText={sensors.location ? 'ACTIVE' : 'DISABLED'}
            mode="AGENT"
          />
        </Card>

        {/* Connection */}
        <Card title="NETWORK" variant="agent" style={styles.section}>
           <View style={styles.connInfo}>
              <Ionicons name="wifi" size={16} color={statusColor} />
              <Text style={styles.connUrl} numberOfLines={1}>{streamManager.currentStats.errorMessage || 'Link Stable'}</Text>
           </View>
        </Card>

        {/* Recent activity */}
        <Card title="LOGS" variant="agent" style={styles.section}>
          {detections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>NO RECENT EVENTS</Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {detections.slice(0, 3).map((d) => (
                <DetectionRow key={d.id} event={d} mode="AGENT" />
              ))}
            </View>
          )}
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg.default },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.lg,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  statusBlock: {
    alignItems: 'center',
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    letterSpacing: 4,
    fontFamily: FONTS.mono,
  },
  agentIdText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: FONTS.mono,
  },
  section: {
    marginTop: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.bg.elevated,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    color: COLORS.agent.primary,
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: FONTS.mono,
  },
  statLabel: {
    color: COLORS.text.muted,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 2,
  },
  sensorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sensorCardSub: {
    color: COLORS.text.muted,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONTS.mono,
    letterSpacing: 1,
  },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: COLORS.bg.elevated,
    borderWidth: 1,
    borderColor: COLORS.agent.primary + '40',
  },
  flipText: {
    color: COLORS.agent.primary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  sensorDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  connInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  connUrl: {
    color: COLORS.text.muted,
    fontSize: 12,
    fontFamily: FONTS.mono,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  emptyText: {
    color: COLORS.text.ghost,
    fontSize: 10,
    fontFamily: FONTS.mono,
  },
  activityList: {
    gap: 8,
  },
});
