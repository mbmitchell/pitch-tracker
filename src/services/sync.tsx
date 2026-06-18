import NetInfo from '@react-native-community/netinfo';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  isRemoteAppDataEnabled,
  isScreenshotModeEnabled,
  screenshotModeLog,
} from '@/features/screenshot/screenshotMode';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  countUnsyncedQueueEntries,
  enqueueLocalSyncMutation,
  LocalQueueEntry,
  LocalSyncState,
  listLocalSyncQueueEntries,
  resetLocalOfflineData,
  updateLocalAssignedWorkoutSyncState,
  updateLocalPitchBreakdownSyncState,
  updateLocalPitcherSyncState,
  updateLocalSyncQueueEntry,
  updateLocalThrowingEventSyncState,
  upsertLocalAssignedWorkout,
  upsertLocalPitchBreakdownRows,
  upsertLocalPitcher,
  upsertLocalThrowingEvent,
} from '@/services/localData';
import { useAuth } from '@/services/auth';
import {
  AssignedWorkout,
  AssignedWorkoutUpdate,
  EventPitchBreakdown,
  EventPitchBreakdownInsert,
  PitcherProfile,
  PitcherProfileInsert,
  PitcherProfileUpdate,
  ThrowingEvent,
  ThrowingEventInsert,
} from '@/types/models';

export type SyncQueueDisplayItem = LocalQueueEntry & {
  entity_type:
    | 'pitcher_profile'
    | 'throwing_event'
    | 'event_pitch_breakdown'
    | 'assigned_workout';
};

type SyncIndicatorState = {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  label: string;
};

const SyncContext = createContext<SyncIndicatorState | null>(null);

let onlineState = true;
const syncingByCoach = new Map<string, Promise<void>>();
const syncListeners = new Set<() => void>();
const MAX_SYNC_RETRY_ATTEMPTS = 3;

function notifySyncListeners() {
  syncListeners.forEach((listener) => listener());
}

/**
 * Returns the last known connectivity state shared by the sync layer.
 *
 * @returns true when the app currently considers itself online
 */
export function getIsOnline() {
  return onlineState;
}

/**
 * Recomputes unsynced queue work for the current coach.
 *
 * @param coachId - authenticated coach id
 * @returns number of queue entries that are not yet synced
 */
export async function refreshPendingSyncCount(coachId: string) {
  return countUnsyncedQueueEntries(coachId);
}

/**
 * Counts currently failed queue items for one coach.
 *
 * @param coachId - authenticated coach id
 * @returns count of failed queue entries
 */
export async function refreshFailedSyncCount(coachId: string) {
  const failedEntries = await listLocalSyncQueueEntries(coachId, ['failed']);
  return failedEntries.length;
}

function getSupabaseClient() {
  return supabase as any;
}

/**
 * Maps queue mutation types to the user-facing entity categories shown in sync details.
 *
 * @param mutationType - stored queue mutation type
 * @returns derived entity type label
 */
export function getSyncEntityType(
  mutationType: LocalQueueEntry['mutation_type']
): SyncQueueDisplayItem['entity_type'] {
  switch (mutationType) {
    case 'create_pitcher':
    case 'update_pitcher':
      return 'pitcher_profile';
    case 'create_throwing_event':
      return 'throwing_event';
    case 'update_assigned_workout':
      return 'assigned_workout';
    default:
      return 'event_pitch_breakdown';
  }
}

/**
 * Builds a readable sync queue item shape for the details screen.
 *
 * @param entry - raw queue entry from local storage
 * @returns queue item enriched with a derived entity type
 */
export function toSyncQueueDisplayItem(entry: LocalQueueEntry): SyncQueueDisplayItem {
  return {
    ...entry,
    entity_type: getSyncEntityType(entry.mutation_type),
  };
}

async function syncCreatePitcher(coachId: string, queueEntry: LocalQueueEntry) {
  const supabaseClient = getSupabaseClient();
  const payload = JSON.parse(queueEntry.payload_json) as PitcherProfileInsert;

  const { data, error } = await supabaseClient
    .from('pitcher_profiles')
    .upsert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await upsertLocalPitcher(coachId, data as PitcherProfile, 'synced');
  await updateLocalPitcherSyncState(queueEntry.entity_id, 'synced');
}

async function syncUpdatePitcher(coachId: string, queueEntry: LocalQueueEntry) {
  const supabaseClient = getSupabaseClient();
  const payload = JSON.parse(queueEntry.payload_json) as PitcherProfileUpdate & {
    id: string;
  };

  const { data, error } = await supabaseClient
    .from('pitcher_profiles')
    .update(payload)
    .eq('id', payload.id)
    .eq('created_by', coachId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Pitcher profile not found during sync.');
  }

  await upsertLocalPitcher(coachId, data as PitcherProfile, 'synced');
  await updateLocalPitcherSyncState(queueEntry.entity_id, 'synced');
}

async function syncCreateThrowingEvent(coachId: string, queueEntry: LocalQueueEntry) {
  const supabaseClient = getSupabaseClient();
  const payload = JSON.parse(queueEntry.payload_json) as ThrowingEventInsert;

  const { data, error } = await supabaseClient
    .from('throwing_events')
    .upsert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await upsertLocalThrowingEvent(coachId, data as ThrowingEvent, 'synced');
  await updateLocalThrowingEventSyncState(queueEntry.entity_id, 'synced');
}

async function syncCreatePitchBreakdown(coachId: string, queueEntry: LocalQueueEntry) {
  const supabaseClient = getSupabaseClient();
  const payload = JSON.parse(queueEntry.payload_json) as EventPitchBreakdownInsert;

  const { data, error } = await supabaseClient
    .from('event_pitch_breakdown')
    .upsert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await upsertLocalPitchBreakdownRows(coachId, [data as EventPitchBreakdown], 'synced');
  await updateLocalPitchBreakdownSyncState(queueEntry.entity_id, 'synced');
}

async function syncUpdateAssignedWorkout(coachId: string, queueEntry: LocalQueueEntry) {
  const supabaseClient = getSupabaseClient();
  const payload = JSON.parse(queueEntry.payload_json) as AssignedWorkoutUpdate & { id: string };

  const { data, error } = await supabaseClient
    .from('assigned_workouts')
    .update(payload)
    .eq('id', payload.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await upsertLocalAssignedWorkout(coachId, data as AssignedWorkout, 'synced');
  await updateLocalAssignedWorkoutSyncState(queueEntry.entity_id, 'synced');
}

async function processQueueEntry(coachId: string, queueEntry: LocalQueueEntry) {
  await updateLocalSyncQueueEntry(queueEntry.id, 'syncing', null, queueEntry.retry_count);
  notifySyncListeners();

  switch (queueEntry.mutation_type) {
    case 'create_pitcher':
      await syncCreatePitcher(coachId, queueEntry);
      break;
    case 'update_pitcher':
      await syncUpdatePitcher(coachId, queueEntry);
      break;
    case 'create_throwing_event':
      await syncCreateThrowingEvent(coachId, queueEntry);
      break;
    case 'create_pitch_breakdown':
      await syncCreatePitchBreakdown(coachId, queueEntry);
      break;
    case 'update_assigned_workout':
      await syncUpdateAssignedWorkout(coachId, queueEntry);
      break;
    default:
      throw new Error(`Unsupported sync mutation: ${queueEntry.mutation_type}`);
  }

  await updateLocalSyncQueueEntry(queueEntry.id, 'synced', null, queueEntry.retry_count);
}

/**
 * Processes queued local mutations for a coach in FIFO order.
 *
 * Parent-child ordering is preserved by queue order so offline-created pitchers
 * sync before their events, and events sync before their pitch breakdown rows.
 *
 * @param coachId - authenticated coach id
 */
export async function processPendingSyncQueueForCoach(coachId: string) {
  if (!coachId || !getIsOnline() || !isRemoteAppDataEnabled(isSupabaseConfigured)) {
    if (isScreenshotModeEnabled) {
      screenshotModeLog('Skipping sync queue processing in local-only screenshot mode.');
    }
    return;
  }

  const existing = syncingByCoach.get(coachId);
  if (existing) {
    return existing;
  }

  const syncPromise = (async () => {
    const entries = await listLocalSyncQueueEntries(coachId, ['pending', 'failed']);

    for (const entry of entries) {
      if (entry.retry_count >= MAX_SYNC_RETRY_ATTEMPTS) {
        continue;
      }

      try {
        await processQueueEntry(coachId, entry);
      } catch (error) {
        const nextRetryCount = entry.retry_count + 1;
        await updateLocalSyncQueueEntry(
          entry.id,
          'failed',
          error instanceof Error ? error.message : 'Sync failed.',
          nextRetryCount
        );
        notifySyncListeners();
        break;
      }
    }
  })().finally(() => {
    syncingByCoach.delete(coachId);
    notifySyncListeners();
  });

  syncingByCoach.set(coachId, syncPromise);
  notifySyncListeners();
  return syncPromise;
}

/**
 * Manually triggers queue processing for one coach.
 *
 * Useful for testing and for future pull-to-sync style actions.
 *
 * @param coachId - authenticated coach id
 */
export async function triggerSyncNowForCoach(coachId: string) {
  return processPendingSyncQueueForCoach(coachId);
}

/**
 * Lists pending, syncing, and failed queue items for one coach.
 *
 * @param coachId - authenticated coach id
 * @returns visible queue items for sync details UI
 */
export async function listSyncQueueItemsForCoach(coachId: string) {
  const entries = await listLocalSyncQueueEntries(coachId, ['pending', 'syncing', 'failed']);
  return entries.map(toSyncQueueDisplayItem);
}

/**
 * Retries failed queue entries by resetting them to pending and clearing the latest error.
 *
 * @param coachId - authenticated coach id
 */
export async function retryFailedSyncItemsForCoach(coachId: string) {
  const failedEntries = await listLocalSyncQueueEntries(coachId, ['failed']);

  for (const entry of failedEntries) {
    await updateLocalSyncQueueEntry(entry.id, 'pending', null, 0);
  }

  notifySyncListeners();

  if (getIsOnline()) {
    await triggerSyncNowForCoach(coachId);
  }
}

/**
 * Triggers queue processing for all currently queued work.
 *
 * Failed items are reset to pending first so a manual retry can replay the full queue.
 *
 * @param coachId - authenticated coach id
 */
export async function retryAllSyncItemsForCoach(coachId: string) {
  const queuedEntries = await listLocalSyncQueueEntries(coachId, ['failed', 'pending']);

  for (const entry of queuedEntries) {
    if (entry.status === 'failed') {
      await updateLocalSyncQueueEntry(entry.id, 'pending', null, 0);
    }
  }

  notifySyncListeners();

  if (getIsOnline()) {
    await triggerSyncNowForCoach(coachId);
  }
}

/**
 * Clears all local offline cache and queue data for development testing.
 *
 * This is intentionally dev-only because it removes cached SQLite data and
 * pending local mutations, but it does not touch any Supabase/cloud records.
 */
export async function resetLocalOfflineDataForDevelopment() {
  if (!__DEV__) {
    throw new Error('Local offline data reset is only available in development.');
  }

  await resetLocalOfflineData();
  notifySyncListeners();
}

/**
 * Formats the lightweight sync label shown in the app shell.
 *
 * @param isOnline - current connectivity state
 * @param isSyncing - whether the queue is actively syncing
 * @param pendingCount - count of unsynced queue entries
 * @returns user-facing sync status label
 */
export function buildSyncIndicatorLabel(
  isOnline: boolean,
  isSyncing: boolean,
  pendingCount: number,
  failedCount: number
) {
  if (!isOnline) {
    return 'Offline';
  }

  if (isSyncing) {
    return 'Syncing';
  }

  if (failedCount > 0) {
    return `${failedCount} sync issue${failedCount === 1 ? '' : 's'}`;
  }

  if (pendingCount > 0) {
    return `${pendingCount} change${pendingCount === 1 ? '' : 's'} pending`;
  }

  return 'All changes synced';
}

/**
 * Reads the shared sync indicator state from context.
 *
 * @returns current sync status, connectivity flag, and pending count
 */
export function useSyncStatus() {
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error('useSyncStatus must be used within an OfflineSyncProvider');
  }

  return context;
}

/**
 * Provides connectivity-aware sync state and reconnect-triggered queue processing.
 *
 * @param children - app subtree that consumes sync state
 * @returns provider wrapping the current UI tree
 */
export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() => (isScreenshotModeEnabled ? false : true));

  useEffect(() => {
    onlineState = isOnline;
    notifySyncListeners();
  }, [isOnline]);

  useEffect(() => {
    if (isScreenshotModeEnabled) {
      onlineState = false;
      setIsOnline(false);
      screenshotModeLog('Forcing sync provider offline to avoid any network activity.');
      return;
    }

    let isActive = true;

    async function loadInitialConnectivity() {
      const state = await NetInfo.fetch();

      if (!isActive) {
        return;
      }

      setIsOnline(Boolean(state.isConnected && (state.isInternetReachable ?? true)));
    }

    void loadInitialConnectivity();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function updatePendingState() {
      if (!user?.id) {
        if (isActive) {
          setPendingCount(0);
          setFailedCount(0);
          setIsSyncing(false);
        }
        return;
      }

      const [nextCount, nextFailedCount, syncingEntries] = await Promise.all([
        refreshPendingSyncCount(user.id),
        refreshFailedSyncCount(user.id),
        listLocalSyncQueueEntries(user.id, ['syncing']),
      ]);

      if (isActive) {
        setPendingCount(nextCount);
        setFailedCount(nextFailedCount);
        setIsSyncing(syncingEntries.length > 0);
      }
    }

    void updatePendingState();
    syncListeners.add(updatePendingState);

    return () => {
      isActive = false;
      syncListeners.delete(updatePendingState);
    };
  }, [user?.id]);

  useEffect(() => {
    let isActive = true;

    async function syncIfNeeded() {
      if (!user?.id || !isOnline || !isRemoteAppDataEnabled(isSupabaseConfigured)) {
        return;
      }

      const nextCount = await refreshPendingSyncCount(user.id);

      if (!nextCount || !isActive) {
        return;
      }

      await processPendingSyncQueueForCoach(user.id);
    }

    void syncIfNeeded();

    return () => {
      isActive = false;
    };
  }, [isOnline, user?.id]);

  useEffect(() => {
    if (isScreenshotModeEnabled) {
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state) => {
      const nextIsOnline = Boolean(state.isConnected && (state.isInternetReachable ?? true));
      onlineState = nextIsOnline;
      setIsOnline(nextIsOnline);
    });

    return unsubscribe;
  }, []);

  const value = useMemo<SyncIndicatorState>(
    () => ({
      isOnline,
      isSyncing,
      pendingCount,
      failedCount,
      label: buildSyncIndicatorLabel(isOnline, isSyncing, pendingCount, failedCount),
    }),
    [failedCount, isOnline, isSyncing, pendingCount]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/**
 * Adds a local mutation to the sync queue and notifies status listeners immediately.
 *
 * @param queueEntry - queue record ready to persist
 */
export async function queueLocalSyncMutation(
  queueEntry: Parameters<typeof enqueueLocalSyncMutation>[0]
) {
  await enqueueLocalSyncMutation(queueEntry);
  notifySyncListeners();
}
