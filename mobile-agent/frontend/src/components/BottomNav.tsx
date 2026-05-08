import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../config/theme';

/**
 * Simplified BottomNav for NISHA Mobile Agent.
 */
export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const palette = COLORS.agent;

  const tabs = [
    { icon: 'home-sharp', label: 'HUB', path: '/agent' as const },
    { icon: 'pulse', label: 'ACTIVITY', path: '/activity' as const },
    { icon: 'settings-sharp', label: 'CONFIG', path: '/settings' as const },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const active = pathname === tab.path;
        return (
          <TouchableOpacity
            key={tab.path}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={() => router.push(tab.path)}
            testID={`nav-tab-${tab.label.toLowerCase()}`}
          >
            {active && (
              <View
                style={[
                  styles.activeBar,
                  { backgroundColor: palette.primary, shadowColor: palette.primary },
                ]}
              />
            )}
            <Ionicons
              name={tab.icon as keyof typeof Ionicons.glyphMap}
              size={20}
              color={active ? palette.primary : COLORS.text.muted}
            />
            <Text
              style={[
                styles.label,
                { color: active ? palette.primary : COLORS.text.muted },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 2,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: FONTS.mono,
  },
});
