import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';

interface Props {
  color: string;
  glowColor?: string;
  size?: number;
  pulse?: boolean;
  style?: ViewStyle;
}

export function StatusDot({ color, glowColor, size = 8, pulse = true, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.35, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.45, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, scale, opacity]);

  return (
    <View style={[styles.wrapper, { width: size * 2.5, height: size * 2.5 }, style]}>
      {pulse && (
        <Animated.View
          style={[
            styles.halo,
            {
              width: size * 2.5,
              height: size * 2.5,
              borderRadius: size * 1.25,
              backgroundColor: glowColor || color,
              opacity: Animated.multiply(opacity, 0.3),
              transform: [{ scale }],
            },
          ]}
        />
      )}
      <View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  dot: {
    zIndex: 2,
  },
});
