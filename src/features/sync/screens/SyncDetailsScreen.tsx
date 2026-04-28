import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { useAuth } from '@/services/auth';
import {
  listSyncQueueItemsForCoach,
  resetLocalOfflineDataForDevelopment,
  retryAllSyncItemsForCoach,
  retryFailedSyncItemsForCoach,
  SyncQueueDisplayItem,
  useSyncStatus,
} from '@/services/sync';
import { colors, spacing } from '@/utils/theme';

function formatSyncTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatMutationTypeLabel(value: SyncQueueDisplayItem['mutation_type']) {
  switch (value) {
    case 'create_pitcher':
      return 'Create pitcher';
    case 'update_pitcher':
      return 'Update pitcher';
    case 'create_throwing_event':
      return 'Create throwing event';
    case 'update_assigned_workout':
      return 'Update assigned workout';
    default:
      return 'Create pitch breakdown row';
  }
}

function formatEntityTypeLabel(value: SyncQueueDisplayItem['entity_type']) {
  switch (value) {
    case 'pitcher_profile':
      return 'Pitcher profile';
    case 'throwing_event':
      return 'Throwing event';
    case 'assigned_workout':
      return 'Assigned workout';
    default:
      return 'Pitch breakdown';
  }
}

function statusTone(status: SyncQueueDisplayItem['status']) {
  switch (status) {
    case 'failed':
      return { backgroundColor: colors.dangerSoft, color: colors.danger };
    case 'syncing':
      return { backgroundColor: colors.primarySoft, color: colors.primary };
    default:
      return { backgroundColor: colors.primarySoft, color: colors.primary };
  }
}

function SyncQueueRow({ item }: { item: SyncQueueDisplayItem }) {
  const tone = statusTone(item.status);

  return (
    <View style={styles.queueRow}>
      <View style={styles.queueHeader}>
        <View style={styles.queueHeaderCopy}>
          <Text style={styles.queueTitle}>{formatMutationTypeLabel(item.mutation_type)}</Text>
          <Text style={styles.queueMeta}>{formatEntityTypeLabel(item.entity_type)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: tone.backgroundColor }]}>
          <Text style={[styles.statusBadgeText, { color: tone.color }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.detail}>Created: {formatSyncTimestamp(item.created_at)}</Text>
      <Text style={styles.detail}>Updated: {formatSyncTimestamp(item.updated_at)}</Text>
      <Text style={styles.detail}>Attempts: {item.retry_count}</Text>
      <Text style={styles.detail}>Entity ID: {item.entity_id}</Text>
      {item.last_error ? (
        <Text style={styles.errorText}>Last error: {item.last_error}</Text>
      ) : null}
    </View>
  );
}

/** Shows queued and failed offline sync work with simple retry actions. */
export function SyncDetailsScreen() {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const { failedCount, isOnline, isSyncing, label, pendingCount } = useSyncStatus();
  const [items, setItems] = useState<SyncQueueDisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [isResettingLocalData, setIsResettingLocalData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadQueue() {
      if (!user?.id || !isFocused) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const nextItems = await listSyncQueueItemsForCoach(user.id);
        setItems(nextItems);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to load sync details.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadQueue();
  }, [isFocused, refreshToken, user?.id]);

  const failedItems = useMemo(
    () => items.filter((item) => item.status === 'failed'),
    [items]
  );
  const queuedItems = useMemo(
    () => items.filter((item) => item.status === 'pending' || item.status === 'syncing'),
    [items]
  );

  async function handleRetryFailed() {
    if (!user?.id) {
      return;
    }

    setIsRetryingFailed(true);
    setError(null);

    try {
      await retryFailedSyncItemsForCoach(user.id);
      setRefreshToken((value) => value + 1);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Unable to retry failed sync items.'
      );
    } finally {
      setIsRetryingFailed(false);
    }
  }

  async function handleRetryAll() {
    if (!user?.id) {
      return;
    }

    setIsRetryingAll(true);
    setError(null);

    try {
      await retryAllSyncItemsForCoach(user.id);
      setRefreshToken((value) => value + 1);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Unable to retry queued sync work.'
      );
    } finally {
      setIsRetryingAll(false);
    }
  }

  async function handleResetLocalOfflineData() {
    setIsResettingLocalData(true);
    setError(null);

    try {
      await resetLocalOfflineDataForDevelopment();
      setItems([]);
      setRefreshToken((value) => value + 1);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to reset local offline data.'
      );
    } finally {
      setIsResettingLocalData(false);
    }
  }

  function confirmResetLocalOfflineData() {
    Alert.alert(
      'Reset local offline data?',
      'This clears the local SQLite cache and sync queue on this device for development testing only. Supabase data will not be deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void handleResetLocalOfflineData();
          },
        },
      ]
    );
  }

  return (
    <Screen
      title="Sync details"
      subtitle="Review queued offline changes, failed items, and retry behavior without blocking the rest of the app."
    >
      <SectionCard title="Current status">
        <Text style={styles.summaryText}>Status: {label}</Text>
        <Text style={styles.summaryText}>Online: {isOnline ? 'Yes' : 'No'}</Text>
        <Text style={styles.summaryText}>Syncing now: {isSyncing ? 'Yes' : 'No'}</Text>
        <Text style={styles.summaryText}>Pending changes: {pendingCount}</Text>
        <Text style={styles.summaryText}>Sync issues: {failedCount}</Text>
      </SectionCard>

      <SectionCard title="Actions">
        <PrimaryButton
          disabled={!failedItems.length || isRetryingFailed}
          label="Retry failed sync"
          loading={isRetryingFailed}
          onPress={() => {
            void handleRetryFailed();
          }}
        />
        <PrimaryButton
          disabled={!items.length || isRetryingAll}
          label="Retry all queued sync"
          loading={isRetryingAll}
          onPress={() => {
            void handleRetryAll();
          }}
          tone="secondary"
        />
        {__DEV__ ? (
          <PrimaryButton
            disabled={isResettingLocalData}
            label="Reset local offline data"
            loading={isResettingLocalData}
            onPress={confirmResetLocalOfflineData}
            tone="secondary"
          />
        ) : null}
      </SectionCard>

      {error ? (
        <SectionCard title="Sync error">
          <Text style={styles.errorText}>{error}</Text>
          <PrimaryButton
            label="Refresh"
            onPress={() => {
              setIsLoading(true);
              setError(null);
              setRefreshToken((value) => value + 1);
            }}
            tone="secondary"
          />
        </SectionCard>
      ) : null}

      <SectionCard title={`Pending queue (${queuedItems.length})`}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.detail}>Loading sync queue…</Text>
          </View>
        ) : queuedItems.length ? (
          queuedItems.map((item) => <SyncQueueRow key={item.id} item={item} />)
        ) : (
          <Text style={styles.detail}>No pending or active sync work right now.</Text>
        )}
      </SectionCard>

      <SectionCard title={`Sync issues (${failedItems.length})`}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.detail}>Loading sync issues…</Text>
          </View>
        ) : failedItems.length ? (
          failedItems.map((item) => <SyncQueueRow key={item.id} item={item} />)
        ) : (
          <Text style={styles.detail}>No failed sync items right now.</Text>
        )}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  queueRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  queueHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  queueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  queueMeta: {
    fontSize: 13,
    color: colors.muted,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  detail: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
});
