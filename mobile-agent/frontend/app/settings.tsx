/**
 * Settings Screen - Agent configuration & hardware status
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACING } from '../src/config/theme';
import { useModeStore } from '../src/store/useModeStore';
import { useAgentStore } from '../src/store/useAgentStore';
import { Card } from '../src/components/Card';
import { BottomNav } from '../src/components/BottomNav';
import { NeonButton } from '../src/components/NeonButton';
import { TopBar } from '../src/components/TopBar';

export default function SettingsScreen() {
  const router = useRouter();
  const agentId = useAgentStore((s) => s.agentId);
  const battery = useAgentStore((s) => s.battery);

  const palette = COLORS.agent;

  const handleReset = () => {
    Alert.alert(
      'Reset Agent Registration',
      'This will re-initialize your agent identity with the Sentinel.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            useModeStore.getState().resetAgent();
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <TopBar battery={battery} label="AGENT" mode="AGENT" />
      </SafeAreaView>

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          testID="settings-back-btn"
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerLabel}>CONFIGURATION</Text>
          <Text style={styles.headerTitle}>SETTINGS</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Current role card */}
        <Card title="ACTIVE IDENTITY" variant="agent">
          <View style={styles.roleHeader}>
            <View
              style={[
                styles.roleIcon,
                {
                  borderColor: palette.primary,
                  backgroundColor: palette.surfaceActive,
                  shadowColor: palette.primary,
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={36}
                color={palette.primary}
              />
            </View>
            <View style={styles.roleInfo}>
              <Text style={[styles.roleName, { color: palette.primary }]}>
                A G E N T
              </Text>
              <Text style={styles.roleId}>ID {agentId}</Text>
              <Text style={styles.roleSince}>HARDWARE ENCLAVE ACTIVE</Text>
            </View>
          </View>
        </Card>

        {/* Privacy */}
        <Card title="PRIVACY & SECURITY" variant="default" style={styles.section}>
          <SettingRow icon="lock-closed" label="Data Encryption" value="AES-256" />
          <SettingRow icon="shield-checkmark" label="Local Processing" value="ENABLED" />
          <SettingRow icon="eye-off" label="Anonymous Reporting" value="ENABLED" />
          <SettingRow icon="server" label="Cloud Sync" value="REAL-TIME" />
        </Card>

        {/* Device info */}
        <Card title="DEVICE INFORMATION" variant="default" style={styles.section}>
          <SettingRow icon="hardware-chip" label="App Version" value="v2.4.1" />
          <SettingRow icon="phone-portrait" label="Device ID" value={agentId} />
          <SettingRow
            icon="git-branch"
            label="Build"
            value="SECURE_AGENT"
          />
        </Card>

        {/* Dev tools */}
        <Card title="DEVELOPER" variant="default" style={styles.section}>
          <NeonButton
            label="RESET IDENTITY (DEV)"
            variant="danger"
            size="sm"
            fullWidth
            onPress={handleReset}
            testID="reset-mode-btn"
          />
        </Card>

        <View style={{ height: 20 }} />
      </ScrollView>

      <BottomNav mode="AGENT" />
    </View>
  );
}

function SettingRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.left}>
        <Ionicons name={icon} size={14} color={COLORS.text.secondary} />
        <Text style={rowStyles.label}>{label}</Text>
      </View>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  label: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  value: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: FONTS.mono,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg.default },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg.surface,
  },
  headerContent: { flex: 1, gap: 2 },
  headerLabel: {
    color: COLORS.text.muted,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  headerTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: FONTS.heading,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  section: {
    marginTop: SPACING.md,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
  },
  roleIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  roleInfo: { flex: 1, gap: 4 },
  roleName: {
    fontSize: FONT_SIZES['2xl'],
    fontWeight: '900',
    letterSpacing: 4,
    fontFamily: FONTS.heading,
  },
  roleId: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    fontFamily: FONTS.mono,
    letterSpacing: 1,
  },
  roleSince: {
    color: COLORS.text.muted,
    fontSize: 10,
    fontFamily: FONTS.mono,
    letterSpacing: 1,
  },
});
