import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACING } from '../config/theme';
import { DetectionEvent } from '../types/mode';
import { StatusDot } from './StatusDot';

interface Props {
  event: DetectionEvent;
  mode: 'AGENT' | 'MASTER';
  onPress?: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const ICON_MAP = {
  audio: 'volume-high',
  video: 'videocam',
  location: 'navigate-circle',
} as const;

export function DetectionRow({ event, mode, onPress }: Props) {
  const palette = mode === 'AGENT' ? COLORS.agent : COLORS.master;
  const priorityColor =
    event.priority === 1
      ? COLORS.status.danger
      : event.priority === 2
      ? COLORS.status.warning
      : COLORS.status.success;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
      testID={`detection-row-${event.id}`}
    >
      <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />

      <View style={[styles.iconBox, { borderColor: palette.border }]}>
        <Ionicons
          name={ICON_MAP[event.type]}
          size={16}
          color={palette.primary}
        />
      </View>

      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.subtype}>{event.subType}</Text>
          <Text style={styles.time}>{timeAgo(event.timestamp)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.meta}>
            CONF <Text style={{ color: palette.primary }}>{event.confidence}%</Text>
          </Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.meta}>
            P{event.priority}
          </Text>
          <Text style={styles.separator}>•</Text>
          {event.forwarded ? (
            <View style={styles.forwardedBadge}>
              <StatusDot color={COLORS.status.success} size={5} pulse={false} />
              <Text style={[styles.meta, { color: COLORS.status.success }]}>
                {event.forwardedTo ? `SENT ${event.forwardedTo.toUpperCase()}` : 'SENT'}
              </Text>
            </View>
          ) : (
            <Text style={[styles.meta, { color: COLORS.status.warning }]}>
              BUFFERED
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  priorityBar: {
    width: 2,
    height: 32,
    borderRadius: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg.elevated,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtype: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
    flex: 1,
  },
  time: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZES.xs,
    fontFamily: FONTS.mono,
    letterSpacing: 0.5,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  meta: {
    color: COLORS.text.muted,
    fontSize: 10,
    fontFamily: FONTS.mono,
    letterSpacing: 1.2,
  },
  separator: {
    color: COLORS.text.ghost,
    fontSize: 10,
  },
  forwardedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
