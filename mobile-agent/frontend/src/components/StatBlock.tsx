import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../config/theme';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  testID?: string;
}

export function StatBlock({ label, value, unit, color, testID }: Props) {
  return (
    <View style={styles.block} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, color ? { color } : null]}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: COLORS.text.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    fontFamily: FONTS.mono,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  value: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    fontFamily: FONTS.mono,
    letterSpacing: 0.5,
  },
  unit: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontFamily: FONTS.mono,
    letterSpacing: 0.5,
  },
});
