import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { PitcherStaffOverviewRow } from '@/features/dashboard/components/PitcherStaffOverviewRow';
import {
  filterPitcherStaffOverviewByReadiness,
  PitcherStaffOverview,
  READINESS_FILTER_CONFIG,
  ReadinessFilterKey,
} from '@/features/dashboard/utils/staffOverview';
import { useAuth } from '@/services/auth';
import {
  getStaffOverviewLoadErrorMessage,
  loadStaffOverviewForCoach,
} from '@/features/dashboard/services/staffOverview';
import { useSyncStatus } from '@/services/sync';
import { colors, spacing } from '@/utils/theme';

type ReadinessPitcherListScreenProps = {
  filter: ReadinessFilterKey;
};

const dashboardHref = '/dashboard' as Href;

/** Renders the filtered readiness drill-down list from the dashboard. */
export function ReadinessPitcherListScreen({
  filter,
}: ReadinessPitcherListScreenProps) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { isOnline } = useSyncStatus();
  const [overview, setOverview] = useState<PitcherStaffOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadOverview() {
      if (!user?.id || !isFocused) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        setOverview(await loadStaffOverviewForCoach(user.id));
      } catch (nextError) {
        setOverview([]);
        setError(getStaffOverviewLoadErrorMessage(nextError, isOnline));
      } finally {
        setIsLoading(false);
      }
    }

    void loadOverview();
  }, [isFocused, isOnline, refreshToken, user?.id]);

  const config = READINESS_FILTER_CONFIG[filter];
  const filteredOverview = filterPitcherStaffOverviewByReadiness(overview, filter);

  return (
    <Screen title={config.screenTitle} subtitle={config.subtitle}>
      <SectionCard title="Pitchers">
        {isLoading ? (
          <View style={styles.inlineState}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.copy}>Loading filtered pitchers...</Text>
          </View>
        ) : null}

        {!isLoading && error ? (
          <View style={styles.errorState}>
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

        {!isLoading && !error && filteredOverview.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{config.emptyTitle}</Text>
            <Text style={styles.copy}>
              This view updates from the same readiness rules used on the dashboard.
            </Text>
            <PrimaryButton
              label="Back to dashboard"
              onPress={() => router.replace(dashboardHref)}
              tone="secondary"
            />
          </View>
        ) : null}

        {!isLoading && !error
          ? filteredOverview.map((item) => (
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
  errorState: {
    gap: spacing.sm,
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
    textAlign: 'center',
  },
});
