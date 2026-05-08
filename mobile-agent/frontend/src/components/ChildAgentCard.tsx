import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACING } from '../config/theme';
import { ChildAgent } from '../types/mode';
import { StatusDot } from './StatusDot';

interface Props {
  child: ChildAgent;
  onPing?: (id: string) => void;
  onReboot?: (id: string) => void;
  onConfig?: (id: string) => void;
}

function secondsSince(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

function rssiBars(rssi: number): number {
  if (rssi >= -60) return 5;
  if (rssi >= -70) return 4;
  if (rssi >= -80) return 3;
  if (rssi >= -90) return 2;
  return 1;
}

export function ChildAgentCard({ child, onPing, onReboot, onConfig }: Props) {
  const bars = rssiBars(child.rssi);
  const statusColor =
    child.status === 'ACTIVE'
      ? COLORS.status.success
      : child.status === 'IDLE'
      ? COLORS.status.warning
      : COLORS.status.danger;

  return (
    <View style={styles.card} testID={`child-agent-${child.id}`}>
      <View style={styles.header}>
        <View style={styles.idBlock}>
          <StatusDot color={statusColor} size={7} />
          <Text style={styles.id}>{child.displayName}</Text>
          <Text style={styles.status}>{child.status}</Text>
        </View>

        <View style={styles.signalBlock}>
          <View style={styles.bars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: 3 + i * 2,
                    backgroundColor:
                      i < bars ? COLORS.master.primary : COLORS.border,
                    opacity: i < bars ? 1 : 0.4,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.dbm}>{child.rssi} dBm</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.sensorPill}>
          <Ionicons
            name="mic"
            size={10}
            color={child.audio ? COLORS.master.primary : COLORS.text.ghost}
          />
          <Text style={[styles.sensorText, child.audio && styles.sensorActive]}>
            AUDIO
          </Text>
        </View>
        <View style={styles.sensorPill}>
          <Ionicons
            name="videocam"
            size={10}
            color={child.video ? COLORS.master.primary : COLORS.text.ghost}
          />
          <Text style={[styles.sensorText, child.video && styles.sensorActive]}>
            VIDEO
          </Text>
        </View>
        <View style={styles.sensorPill}>
          <Ionicons
            name="battery-half"
            size={10}
            color={
              child.battery > 30 ? COLORS.status.success : COLORS.status.warning
            }
          />
          <Text style={styles.sensorText}>{child.battery}%</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.lastSeen}>{secondsSince(child.lastSeen)}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onPing?.(child.id)}
          testID={`child-action-ping-${child.id}`}
        >
          <Ionicons name="pulse" size={12} color={COLORS.master.primary} />
          <Text style={styles.actionLabel}>PING</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onReboot?.(child.id)}
          testID={`child-action-reboot-${child.id}`}
        >
          <Ionicons name="refresh" size={12} color={COLORS.master.primary} />
          <Text style={styles.actionLabel}>REBOOT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onConfig?.(child.id)}
          testID={`child-action-config-${child.id}`}
        >
          <Ionicons name="settings-sharp" size={12} color={COLORS.master.primary} />
          <Text style={styles.actionLabel}>CONFIG</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bg.surface,
    borderWidth: 1,
    borderColor: COLORS.master.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  id: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    fontFamily: FONTS.mono,
    letterSpacing: 1,
  },
  status: {
    color: COLORS.master.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: FONTS.mono,
  },
  signalBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
    height: 14,
  },
  bar: {
    width: 2.5,
    borderRadius: 1,
  },
  dbm: {
    color: COLORS.text.secondary,
    fontSize: 10,
    fontFamily: FONTS.mono,
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  sensorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sensorText: {
    fontSize: 9,
    color: COLORS.text.muted,
    fontFamily: FONTS.mono,
    letterSpacing: 1,
    fontWeight: '700',
  },
  sensorActive: {
    color: COLORS.master.primary,
  },
  lastSeen: {
    color: COLORS.text.muted,
    fontSize: 10,
    fontFamily: FONTS.mono,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.master.border,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.master.surfaceActive,
  },
  actionLabel: {
    color: COLORS.master.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: FONTS.mono,
  },
});
