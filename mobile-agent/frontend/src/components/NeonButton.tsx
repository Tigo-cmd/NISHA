import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '../config/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'agent' | 'master' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  testID?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function NeonButton({
  label,
  onPress,
  variant = 'agent',
  disabled,
  loading,
  size = 'md',
  fullWidth,
  testID,
  style,
  textStyle,
}: Props) {
  const palette =
    variant === 'agent'
      ? COLORS.agent
      : variant === 'master'
      ? COLORS.master
      : null;

  const buttonStyles: ViewStyle[] = [styles.base];
  const labelStyles: TextStyle[] = [styles.label];

  if (size === 'sm') {
    buttonStyles.push(styles.sizeSm);
    labelStyles.push(styles.labelSm);
  } else if (size === 'lg') {
    buttonStyles.push(styles.sizeLg);
    labelStyles.push(styles.labelLg);
  } else {
    buttonStyles.push(styles.sizeMd);
  }

  if (palette) {
    buttonStyles.push({
      borderColor: palette.primary,
      backgroundColor: palette.surfaceActive,
      shadowColor: palette.primary,
    });
    labelStyles.push({ color: palette.primary });
  } else if (variant === 'danger') {
    buttonStyles.push({
      borderColor: COLORS.status.danger,
      backgroundColor: 'rgba(255,59,48,0.06)',
    });
    labelStyles.push({ color: COLORS.status.danger });
  } else if (variant === 'ghost') {
    buttonStyles.push({
      borderColor: COLORS.border,
      backgroundColor: 'transparent',
    });
    labelStyles.push({ color: COLORS.text.secondary });
  } else {
    buttonStyles.push({
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg.elevated,
    });
    labelStyles.push({ color: COLORS.text.primary });
  }

  if (fullWidth) buttonStyles.push({ width: '100%' });
  if (disabled || loading) buttonStyles.push({ opacity: 0.5 });

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[buttonStyles, style]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={palette?.primary || COLORS.text.primary} size="small" />
      ) : (
        <Text style={[labelStyles, textStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  sizeSm: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  sizeMd: {
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.lg,
  },
  sizeLg: {
    paddingVertical: SPACING.base + 2,
    paddingHorizontal: SPACING.xl,
  },
  label: {
    fontSize: FONT_SIZES.base,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  labelSm: {
    fontSize: FONT_SIZES.xs,
    letterSpacing: 1.5,
  },
  labelLg: {
    fontSize: FONT_SIZES.md,
    letterSpacing: 3,
  },
});
