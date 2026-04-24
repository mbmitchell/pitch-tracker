import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PitcherStaffOverview } from '@/features/dashboard/utils/staffOverview';
import { formatPitcherName } from '@/services/pitchers';
import { colors, spacing } from '@/utils/theme';
import {
  formatDateLabel,
  formatEventTypeLabel,
  formatPitchCountLabel,
  formatReadinessLabel,
} from '@/utils/workload';

type PitcherStaffOverviewRowProps = {
  item: PitcherStaffOverview;
  onPress: () => void;
};

function readinessBadgeStyle(status: PitcherStaffOverview['readiness']) {
  switch (status) {
    case 'ready for bullpen':
      return {
        backgroundColor: colors.successSoft,
        color: colors.success,
      };
    case 'moderate':
      return {
        backgroundColor: colors.primarySoft,
        color: colors.primary,
      };
    default:
      return {
        backgroundColor: colors.dangerSoft,
        color: colors.danger,
      };
  }
}

/** Renders one tappable staff-overview row for dashboard and readiness drill-down views. */
export function PitcherStaffOverviewRow({
  item,
  onPress,
}: PitcherStaffOverviewRowProps) {
  const badge = readinessBadgeStyle(item.readiness);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowHeader}>
        <View style={styles.nameBlock}>
          <Text style={styles.name}>{formatPitcherName(item.pitcher)}</Text>
          <Text style={styles.meta}>
            {item.pitcher.level_team ?? item.pitcher.grade ?? 'No team or grade entered'}
          </Text>
        </View>
        <Text
          style={[
            styles.badge,
            { backgroundColor: badge.backgroundColor, color: badge.color },
          ]}
        >
          {formatReadinessLabel(item.readiness)}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Last throwing date</Text>
          <Text style={styles.summaryValue}>
            {item.lastThrowingDate ? formatDateLabel(item.lastThrowingDate) : 'No events yet'}
          </Text>
        </View>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>Recent pitch count</Text>
          <Text style={styles.summaryValue}>
            {item.lastThrowingDate
              ? formatPitchCountLabel(item.recentPitchCount)
              : 'No events yet'}
          </Text>
        </View>
      </View>

      <Text style={styles.meta}>
        Last event:{' '}
        {item.lastEventType ? formatEventTypeLabel(item.lastEventType) : 'No events yet'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  nameBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
  },
  badge: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pressed: {
    opacity: 0.75,
  },
});
