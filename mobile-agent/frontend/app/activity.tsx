/**
 * Agent Activity Screen - Full detection history
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACING } from '../src/config/theme';
import { useAgentStore } from '../src/store/useAgentStore';
import { Card } from '../src/components/Card';
import { DetectionRow } from '../src/components/DetectionRow';
import { BottomNav } from '../src/components/BottomNav';
import { NeonButton } from '../src/components/NeonButton';
import { TopBar } from '../src/components/TopBar';

export default function ActivityScreen() {
  const router = useRouter();
  const { detections, battery, clearDetections } = useAgentStore();

  const critical = detections.filter((d) => d.priority === 1).length;
  const high = detections.filter((d) => d.priority === 2).length;
  const normal = detections.filter((d) => d.priority === 3).length;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <TopBar battery={battery} label="AGENT" mode="AGENT" />
      </SafeAreaView>

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          testID="activity-back-btn"
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerLabel}>DETECTION HISTORY</Text>
          <Text style={styles.headerTitle}>ACTIVITY LOG</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCell, { borderColor: 'rgba(255,59,48,0.3)' }]}>
            <Text style={[styles.summaryValue, { color: COLORS.status.danger }]}>{critical}</Text>
            <Text style={styles.summaryLabel}>CRITICAL</Text>
          </View>
          <View style={[styles.summaryCell, { borderColor: 'rgba(255,204,0,0.3)' }]}>
            <Text style={[styles.summaryValue, { color: COLORS.status.warning }]}>{high}</Text>
            <Text style={styles.summaryLabel}>HIGH</Text>
          </View>
          <View style={[styles.summaryCell, { borderColor: 'rgba(52,199,89,0.3)' }]}>
            <Text style={[styles.summaryValue, { color: COLORS.status.success }]}>{normal}</Text>
            <Text style={styles.summaryLabel}>NORMAL</Text>
          </View>
        </View>

        <Card title={`ALL EVENTS (${detections.length})`} variant="agent" style={styles.section}>
          {detections.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="pulse" size={28} color={COLORS.text.ghost} />
              <Text style={styles.emptyText}>NO DETECTIONS YET</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {detections.map((d) => (
                <View key={d.id} style={styles.item}>
                  <DetectionRow event={d} mode="AGENT" />
                </View>
              ))}
            </View>
          )}
        </Card>

        <View style={styles.actions}>
          <NeonButton
            label="CLEAR LOG"
            variant="danger"
            size="sm"
            onPress={clearDetections}
            testID="clear-activity-btn"
            style={{ flex: 1 }}
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <BottomNav mode="AGENT" />
    </View>
  );
}

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
  headerContent: {
    flex: 1,
    gap: 2,
  },
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
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  summaryCell: {
    flex: 1,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg.surface,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: FONT_SIZES['2xl'],
    fontWeight: '900',
    fontFamily: FONTS.mono,
  },
  summaryLabel: {
    color: COLORS.text.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: FONTS.mono,
  },
  section: {
    marginTop: SPACING.md,
  },
  list: {
    gap: 2,
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyText: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: FONTS.mono,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});
