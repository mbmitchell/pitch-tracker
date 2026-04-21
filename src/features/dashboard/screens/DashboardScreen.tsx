import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { buildPitcherStaffOverview, PitcherStaffOverview } from '@/features/dashboard/utils/staffOverview';
import { useAuth } from '@/services/auth';
import { listThrowingEventsForCoach } from '@/services/events';
import { formatPitcherName, listPitchersForCoach } from '@/services/pitchers';
import { colors, spacing } from '@/utils/theme';
import { formatDateLabel, formatEventTypeLabel } from '@/utils/workload';

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

export function DashboardScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [overview, setOverview] = useState<PitcherStaffOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      if (!user?.id || !isFocused) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [pitchers, events] = await Promise.all([
          listPitchersForCoach(user.id),
          listThrowingEventsForCoach(user.id),
        ]);

        setOverview(buildPitcherStaffOverview(pitchers, events));
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : 'Unable to load staff overview.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, [isFocused, user?.id]);

  const readyCount = overview.filter(
    (item) => item.readiness === 'ready for bullpen'
  ).length;
  const cautionCount = overview.filter(
    (item) => item.readiness === 'rest / caution'
  ).length;

  return (
    <Screen
      title="Staff overview"
      subtitle="Scan recent workload and quick readiness for every pitcher on this coach account."
    >
      <SectionCard title="Today at a glance">
        <View style={styles.statRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{overview.length}</Text>
            <Text style={styles.statLabel}>Pitchers</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{readyCount}</Text>
            <Text style={styles.statLabel}>Ready</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{cautionCount}</Text>
            <Text style={styles.statLabel}>Caution</Text>
          </View>
        </View>
        {isLoading ? (
          <View style={styles.inlineState}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.copy}>Refreshing roster and workload history...</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </SectionCard>

      <SectionCard title="Quick actions">
        <PrimaryButton label="Add pitcher" onPress={() => router.push('/pitchers/new')} />
        <PrimaryButton
          label="Log event"
          onPress={() => router.push('/events/new')}
          tone="secondary"
        />
      </SectionCard>

      <SectionCard title="Pitchers">
        {!isLoading && !error && overview.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No pitchers yet</Text>
            <Text style={styles.copy}>
              Add a pitcher to start tracking roster readiness and recent workload.
            </Text>
            <PrimaryButton
              label="Create first pitcher"
              onPress={() => router.push('/pitchers/new')}
            />
          </View>
        ) : null}

        {!isLoading && !error
          ? overview.map((item) => {
              const badge = readinessBadgeStyle(item.readiness);

              return (
                <Pressable
                  key={item.pitcher.id}
                  onPress={() =>
                    router.push({
                      pathname: '/pitchers/[id]',
                      params: { id: item.pitcher.id },
                    })
                  }
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
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
                      {item.readiness}
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
                      <Text style={styles.summaryValue}>{item.recentPitchCount}</Text>
                    </View>
                  </View>

                  <Text style={styles.meta}>
                    Last event: {item.lastEventType ? formatEventTypeLabel(item.lastEventType) : 'No events yet'}
                  </Text>
                </Pressable>
              );
            })
          : null}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statBlock: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  inlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.danger,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
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
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
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
    fontWeight: '600',
    color: colors.muted,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  pressed: {
    opacity: 0.8,
  },
});
