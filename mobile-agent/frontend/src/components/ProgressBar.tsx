import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACING } from '../config/theme';

interface Props {
  label: string;
  value: number; // 0-100
  color?: string;
  showPercent?: boolean;
  height?: number;
  suffix?: string;
}

export function ProgressBar({
  label,
  value,
  color = COLORS.agent.primary,
  showPercent = true,
  height = 6,
  suffix,
}: Props) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>
          {showPercent ? `${clamped.toFixed(0)}%` : value}
          {suffix ? ` ${suffix}` : ''}
        </Text>
      </View>
      <View style={[styles.track, { height, borderColor: COLORS.border }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clamped}%`,
              backgroundColor: color,
              shadowColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: FONTS.mono,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    fontFamily: FONTS.mono,
    letterSpacing: 0.5,
  },
  track: {
    backgroundColor: COLORS.bg.elevated,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
