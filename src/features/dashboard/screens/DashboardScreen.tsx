import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { PitcherStaffOverviewRow } from '@/features/dashboard/components/PitcherStaffOverviewRow';
import {
  buildPitcherStaffOverview,
  PitcherStaffOverview,
  READINESS_FILTER_CONFIG,
  ReadinessFilterKey,
} from '@/features/dashboard/utils/staffOverview';
import { useAuth } from '@/services/auth';
import { listThrowingEventsForCoach } from '@/services/events';
import { listPitchersForCoach } from '@/services/pitchers';
import { colors, spacing } from '@/utils/theme';

type TodayAtAGlanceCard = {
  key: 'pitchers' | ReadinessFilterKey;
  label: string;
  value: number;
  onPress: () => void;
};

/** Renders the coach dashboard with readiness summaries and quick actions. */
export function DashboardScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [overview, setOverview] = useState<PitcherStaffOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

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
  }, [isFocused, refreshToken, user?.id]);

  const readyCount = overview.filter((item) => item.readiness === 'ready for bullpen').length;
  const moderateCount = overview.filter((item) => item.readiness === 'moderate').length;
  const cautionCount = overview.filter((item) => item.readiness === 'rest / caution').length;

  const todayAtAGlanceCards: TodayAtAGlanceCard[] = [
    {
      key: 'pitchers',
      label: 'Pitchers',
      value: overview.length,
      onPress: () => router.push('/pitchers'),
    },
    {
      key: 'ready',
      label: READINESS_FILTER_CONFIG.ready.cardLabel,
      value: readyCount,
      onPress: () =>
        router.push({
          pathname: '/pitchers/status',
          params: { filter: 'ready' },
        }),
    },
    {
      key: 'moderate',
      label: READINESS_FILTER_CONFIG.moderate.cardLabel,
      value: moderateCount,
      onPress: () =>
        router.push({
          pathname: '/pitchers/status',
          params: { filter: 'moderate' },
        }),
    },
    {
      key: 'caution',
      label: READINESS_FILTER_CONFIG.caution.cardLabel,
      value: cautionCount,
      onPress: () =>
        router.push({
          pathname: '/pitchers/status',
          params: { filter: 'caution' },
        }),
    },
  ];

  return (
    <Screen
      title="Staff overview"
      subtitle="Scan recent workload and quick readiness for every pitcher on this coach account."
    >
      <SectionCard title="Today at a glance">
        <View style={styles.cardGrid}>
          {todayAtAGlanceCards.map((card) => (
            <Pressable
              key={card.key}
              onPress={card.onPress}
              style={({ pressed }) => [styles.statBlock, pressed && styles.pressed]}
            >
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </Pressable>
          ))}
        </View>
        {isLoading ? (
          <View style={styles.inlineStateRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.copy}>Refreshing roster and workload history...</Text>
          </View>
        ) : null}
        {!isLoading && error ? (
          <View style={styles.inlineState}>
            <Text style={styles.errorText}>{error}</Text>
            <PrimaryButton
              label="Try again"
              onPress={() => {
                setIsLoading(true);
                setError(null);
                setRefreshToken((value) => value + 1);
              }}
              tone="secondary"
            />
          </View>
        ) : null}
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
          ? overview.map((item) => (
              <PitcherStaffOverviewRow
                key={item.pitcher.id}
                item={item}
                onPress={() =>
                  router.push({
                    pathname: '/pitchers/[id]',
                    params: { id: item.pitcher.id },
                  })
                }
              />
            ))
          : null}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statBlock: {
    width: '47%',
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
    gap: spacing.sm,
  },
  inlineStateRow: {
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
  pressed: {
    opacity: 0.8,
  },
});
