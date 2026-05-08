/**
 * Splash / Router entry.
 * - If mode unselected → redirect to /mode-selection
 * - If AGENT → /agent
 * - If MASTER → /master
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../src/config/theme';
import { useModeStore } from '../src/store/useModeStore';

export default function Index() {
  const router = useRouter();
  const mode = useModeStore((s) => s.mode);
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    const t = setTimeout(() => {
      router.replace('/agent');
    }, 2000);

    return () => clearTimeout(t);
  }, [router]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const statusText = 'INITIALIZING AGENT...';

  return (
    <View style={styles.container}>
      <View style={styles.logoSection}>
        <Animated.View
          style={[
            styles.ring,
            { transform: [{ rotate }] },
          ]}
        >
          <View style={[styles.ringDot, { backgroundColor: COLORS.agent.primary, shadowColor: COLORS.agent.primary }]} />
        </Animated.View>
        <Animated.View
          style={[
            styles.logoHalo,
            { transform: [{ scale: pulseScale }] },
          ]}
        />
        <View style={styles.logoCore}>
          <Text style={styles.logoText} testID="splash-logo">NISHA</Text>
          <View style={styles.logoLine} />
          <Text style={styles.logoTag}>GUARDIAN NETWORK</Text>
        </View>
      </View>

      <View style={styles.statusSection}>
        <Text style={styles.statusText}>{statusText}</Text>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                transform: [
                  {
                    scaleX: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        <Text style={styles.version}>v2.4.1 — SECURE BUILD</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg.default,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  ringDot: {
    position: 'absolute',
    top: -4,
    left: 88,
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  ringDotRight: {
    top: 172,
    left: 88,
  },
  logoHalo: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.agent.glowSoft,
  },
  logoCore: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  logoText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZES['4xl'],
    fontWeight: '900',
    letterSpacing: 8,
    fontFamily: FONTS.heading,
  },
  logoLine: {
    width: 60,
    height: 1,
    backgroundColor: COLORS.agent.primary,
    shadowColor: COLORS.agent.primary,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  logoTag: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZES.xs,
    letterSpacing: 4,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  statusSection: {
    alignItems: 'center',
    gap: SPACING.md,
    width: '100%',
    paddingHorizontal: SPACING.xl,
  },
  statusText: {
    color: COLORS.agent.primary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: FONTS.mono,
  },
  progressBar: {
    width: '60%',
    height: 2,
    backgroundColor: COLORS.bg.elevated,
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.agent.primary,
    transformOrigin: 'left',
  },
  version: {
    color: COLORS.text.muted,
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: FONTS.mono,
  },
});
