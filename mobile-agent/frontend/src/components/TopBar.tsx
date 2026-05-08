import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACING } from '../config/theme';
import { StatusDot } from './StatusDot';

interface Props {
  battery: number;
  masterName?: string;
  label?: string;
}

/**
 * Simplified TopBar for NISHA Mobile Agent.
 * Fixed to Agent palette.
 */
export function TopBar({ battery, masterName, label }: Props) {
  const palette = COLORS.agent;
  const batteryColor =
    battery > 50
      ? COLORS.status.success
      : battery > 20
        ? COLORS.status.warning
        : COLORS.status.danger;

  return (
    <View style={styles.container}>
      <View style={styles.brandWrap}>
        <View style={[styles.brandDot, { backgroundColor: palette.primary, shadowColor: palette.primary }]} />
        <Text style={styles.brand}>NISHA</Text>
        {label && (
          <View style={[styles.badge, { borderColor: palette.primary }]}>
            <Text style={[styles.badgeText, { color: palette.primary }]}>{label}</Text>
          </View>
        )}
      </View>

      <View style={styles.rightSide}>
        {masterName && (
          <View style={styles.chipRow}>
            <StatusDot color={COLORS.status.success} size={6} />
            <Text style={styles.chipText}>{masterName}</Text>
          </View>
        )}
        <View style={styles.batteryRow}>
          <Ionicons
            name={
              battery > 75
                ? 'battery-full'
                : battery > 40
                  ? 'battery-half'
                  : 'battery-dead'
            }
            size={16}
            color={batteryColor}
          />
          <Text style={[styles.batteryText, { color: batteryColor }]}>{battery}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg.default,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  brand: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.text.primary,
    letterSpacing: 4,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    marginLeft: SPACING.xs,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: FONTS.mono,
  },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bg.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZES.xs,
    fontFamily: FONTS.mono,
    letterSpacing: 1,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    fontFamily: FONTS.mono,
    letterSpacing: 0.5,
  },
});
