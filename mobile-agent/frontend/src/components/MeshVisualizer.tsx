import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS } from '../config/theme';

interface Props {
  mode: 'AGENT' | 'MASTER';
  size?: number;
  active?: boolean;
}

/**
 * Stylized animated mesh visualization: central node with orbiting satellites
 * and rotating radar sweep. Used on main dashboards.
 */
export const MeshVisualizer = React.memo(({ mode, size = 260, active = true }: Props) => {
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const color = mode === 'AGENT' ? COLORS.agent.primary : COLORS.master.primary;
  const glow = mode === 'AGENT' ? COLORS.agent.glow : COLORS.master.glow;

  useEffect(() => {
    const r = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    r.start();
    p.start();
    return () => {
      r.stop();
      p.stop();
    };
  }, [rotate, pulse]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.14],
  });

  const orbitSize = size * 0.85;
  const midOrbitSize = size * 0.55;

  // Satellite positions (6 around outer ring, 4 on mid ring)
  const outerSatellites = Array.from({ length: 6 }).map((_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    return { x: Math.cos(angle) * (orbitSize / 2), y: Math.sin(angle) * (orbitSize / 2) };
  });

  const midSatellites = Array.from({ length: 4 }).map((_, i) => {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    return { x: Math.cos(angle) * (midOrbitSize / 2), y: Math.sin(angle) * (midOrbitSize / 2) };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer orbit ring */}
      <View
        style={[
          styles.ring,
          {
            width: orbitSize,
            height: orbitSize,
            borderRadius: orbitSize / 2,
            borderColor: mode === 'AGENT' ? COLORS.agent.border : COLORS.master.border,
          },
        ]}
      />
      {/* Mid orbit ring */}
      <View
        style={[
          styles.ring,
          {
            width: midOrbitSize,
            height: midOrbitSize,
            borderRadius: midOrbitSize / 2,
            borderColor: mode === 'AGENT' ? COLORS.agent.border : COLORS.master.border,
          },
        ]}
      />

      {/* Rotating sweep line */}
      {active && (
        <Animated.View
          style={[
            styles.sweep,
            {
              width: orbitSize,
              height: orbitSize,
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <View
            style={{
              position: 'absolute',
              top: orbitSize / 2 - 0.5,
              left: orbitSize / 2,
              width: orbitSize / 2,
              height: 1.5,
              backgroundColor: color,
              opacity: 0.7,
              shadowColor: color,
              shadowOpacity: 0.9,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        </Animated.View>
      )}

      {/* Outer satellites */}
      {outerSatellites.map((pos, i) => (
        <View
          key={`o-${i}`}
          style={[
            styles.satellite,
            {
              backgroundColor: color,
              shadowColor: glow,
              transform: [{ translateX: pos.x }, { translateY: pos.y }],
            },
          ]}
        />
      ))}

      {/* Mid satellites */}
      {midSatellites.map((pos, i) => (
        <View
          key={`m-${i}`}
          style={[
            styles.satelliteSmall,
            {
              backgroundColor: color,
              shadowColor: glow,
              opacity: 0.75,
              transform: [{ translateX: pos.x }, { translateY: pos.y }],
            },
          ]}
        />
      ))}

      {/* Central pulse */}
      <Animated.View
        style={[
          styles.centerHalo,
          {
            backgroundColor: mode === 'AGENT' ? COLORS.agent.glowSoft : COLORS.master.glowSoft,
            transform: [{ scale }],
          },
        ]}
      />
      <View
        style={[
          styles.center,
          {
            borderColor: color,
            shadowColor: color,
          },
        ]}
      >
        <View style={[styles.centerCore, { backgroundColor: color }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  sweep: {
    position: 'absolute',
  },
  satellite: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  satelliteSmall: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.7,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  centerHalo: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  center: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  centerCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
