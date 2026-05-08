import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, FONT_SIZES, RADIUS, SPACING, FONTS } from '../config/theme';

interface Props {
  children: React.ReactNode;
  title?: string;
  variant?: 'default' | 'agent' | 'master';
  style?: ViewStyle;
  testID?: string;
}

export function Card({ children, title, variant = 'default', style, testID }: Props) {
  const borderColor =
    variant === 'agent'
      ? COLORS.agent.border
      : variant === 'master'
      ? COLORS.master.border
      : COLORS.border;

  return (
    <View style={[styles.card, { borderColor }, style]} testID={testID}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bg.surface,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
  },
  title: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
    fontFamily: FONTS.mono,
  },
});
