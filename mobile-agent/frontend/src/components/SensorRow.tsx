import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACING } from '../config/theme';

type SensorType = 'audio' | 'video' | 'location';

interface Props {
  type: SensorType;
  active: boolean;
  onToggle: () => void;
  statusText: string;
  mode: 'AGENT' | 'MASTER';
  testID?: string;
  disabled?: boolean;
}

const ICON_MAP: Record<SensorType, keyof typeof Ionicons.glyphMap> = {
  audio: 'mic',
  video: 'videocam',
  location: 'locate',
};

const LABEL_MAP: Record<SensorType, string> = {
  audio: 'Audio',
  video: 'Video',
  location: 'Location',
};

export function SensorRow({ type, active, onToggle, statusText, mode, testID, disabled }: Props) {
  const palette = mode === 'AGENT' ? COLORS.agent : COLORS.master;
  const indicatorColor = disabled ? COLORS.text.ghost : (active ? palette.primary : COLORS.text.ghost);

  return (
    <TouchableOpacity
      style={[styles.row, { opacity: disabled ? 0.3 : 1 }]}
      onPress={disabled ? undefined : onToggle}
      activeOpacity={0.7}
      testID={testID}
      disabled={disabled}
    >
      <View style={[styles.iconWrap, { borderColor: active && !disabled ? palette.border : COLORS.border }]}>
        <Ionicons name={ICON_MAP[type]} size={18} color={indicatorColor} />
      </View>

      <View style={styles.info}>
        <Text style={[styles.label, { color: disabled ? COLORS.text.muted : COLORS.text.primary }]}>
          {LABEL_MAP[type]}
        </Text>
        <Text style={[styles.status, { color: active && !disabled ? palette.primary : COLORS.text.muted }]}>
          {disabled ? 'LOCKED' : statusText}
        </Text>
      </View>

      {/* Signal bar visualization */}
      <View style={styles.bars}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: 4 + i * 3,
                backgroundColor:
                  active && !disabled && i < 4 ? palette.primary : COLORS.border,
                opacity: active && !disabled ? (i < 4 ? 1 : 0.4) : 0.4,
              },
            ]}
          />
        ))}
      </View>

      {/* Toggle visual */}
      <View
        style={[
          styles.toggle,
          {
            backgroundColor: active && !disabled ? palette.surfaceActive : COLORS.bg.elevated,
            borderColor: active && !disabled ? palette.primary : COLORS.border,
          },
        ]}
      >
        <View
          style={[
            styles.toggleDot,
            {
              backgroundColor: active && !disabled ? palette.primary : COLORS.text.ghost,
              transform: [{ translateX: active && !disabled ? 14 : 0 }],
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg.elevated,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZES.base,
    fontWeight: '600',
  },
  status: {
    fontSize: FONT_SIZES.xs,
    fontFamily: FONTS.mono,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 18,
    marginRight: SPACING.xs,
  },
  bar: {
    width: 3,
    borderRadius: 1,
  },
  toggle: {
    width: 36,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
  },
  toggleDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
