import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  countUnsyncedQueueEntries,
  enqueueLocalSyncMutation,
  listLocalSyncQueueEntries,
  LocalQueueEntry,
  LocalSyncState,
  updateLocalPitchBreakdownSyncState,
  updateLocalPitcherSyncState,
  updateLocalSyncQueueEntry,
  updateLocalThrowingEventSyncState,
  upsertLocalPitchBreakdownRows,
  upsertLocalPitcher,
  upsertLocalThrowingEvent,
} from '@/services/localData';
import {
  EventPitchBreakdown,
  EventPitchBreakdownInsert,
  PitcherProfile,
  PitcherProfileInsert,
  PitcherProfileUpdate,
  ThrowingEvent,
  ThrowingEventInsert,
} from '@/types/models';
import { useAuth } from '@/services/auth';

type SyncIndicatorState = {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  label: string;
};

const SyncContext = createContext<SyncIndicatorState | null>(null);

let onlineState = true;
const syncingByCoach = new Map<string, Promise<void>>();
const syncListeners = new Set<() => void>();

function notifySyncListeners() {
  syncListeners.forEach((listener) => listener());
}

function getSupabaseClient() {
  return supabase as any;
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

async function syncCreatePitcher(coachId: string, queueEntry: LocalQueueEntry) {
  const supabaseClient = getSupabaseClient();
  const payload = JSON.parse(queueEntry.payload_json) as PitcherProfileInsert;

  const { data, error } = await supabaseClient
    .from('pitcher_profiles')
    .insert(payload)
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
    .insert(payload)
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
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await upsertLocalPitchBreakdownRows(coachId, [data as EventPitchBreakdown], 'synced');
  await updateLocalPitchBreakdownSyncState(queueEntry.entity_id, 'synced');
}

async function processQueueEntry(coachId: string, queueEntry: LocalQueueEntry) {
  await updateLocalSyncQueueEntry(queueEntry.id, 'syncing', null, queueEntry.retry_count);

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
    default:
      throw new Error(`Unsupported sync mutation: ${queueEntry.mutation_type}`);
  }

  await updateLocalSyncQueueEntry(queueEntry.id, 'synced');
}

/**
 * Processes queued local mutations for a coach in FIFO order.
 *
 * Queue order matters because offline-created parents must sync before child rows
 * that reference them, so the processor stops on the first failure instead of
 * skipping ahead and creating harder-to-debug state drift.
 *
 * @param coachId - authenticated coach id
 */
export async function processPendingSyncQueueForCoach(coachId: string) {
  if (!coachId || !getIsOnline() || !isSupabaseConfigured) {
    return;
  }

  const existing = syncingByCoach.get(coachId);
  if (existing) {
    return existing;
  }

  const syncPromise = (async () => {
    const entries = await listLocalSyncQueueEntries(coachId);

    for (const entry of entries) {
      try {
        await processQueueEntry(coachId, entry);
      } catch (error) {
        await updateLocalSyncQueueEntry(
          entry.id,
          'failed',
          error instanceof Error ? error.message : 'Sync failed.',
          entry.retry_count + 1
        );
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
  pendingCount: number
) {
  if (!isOnline) {
    return 'Offline';
  }

  if (isSyncing) {
    return 'Syncing';
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
  const netInfo = useNetInfo();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const isOnline = Boolean(
    netInfo.isConnected && (netInfo.isInternetReachable ?? true)
  );

  useEffect(() => {
    onlineState = isOnline;
    notifySyncListeners();
  }, [isOnline]);

  useEffect(() => {
    let isActive = true;

    async function updatePendingState() {
      if (!user?.id) {
        if (isActive) {
          setPendingCount(0);
          setIsSyncing(false);
        }
        return;
      }

      const nextCount = await refreshPendingSyncCount(user.id);

      if (isActive) {
        setPendingCount(nextCount);
        setIsSyncing(syncingByCoach.has(user.id));
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
      if (!user?.id || !isOnline || !isSupabaseConfigured) {
        if (isActive) {
          const nextCount = user?.id ? await refreshPendingSyncCount(user.id) : 0;
          setPendingCount(nextCount);
          setIsSyncing(false);
        }
        return;
      }

      const nextCount = await refreshPendingSyncCount(user.id);

      if (isActive) {
        setPendingCount(nextCount);
        setIsSyncing(syncingByCoach.has(user.id));
      }

      if (!nextCount) {
        return;
      }

      if (isActive) {
        setIsSyncing(true);
      }

      try {
        await processPendingSyncQueueForCoach(user.id);
      } finally {
        if (!isActive) {
          return;
        }

        setIsSyncing(false);
        setPendingCount(await refreshPendingSyncCount(user.id));
      }
    }

    void syncIfNeeded();

    return () => {
      isActive = false;
    };
  }, [isOnline, user?.id]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      onlineState = Boolean(state.isConnected && (state.isInternetReachable ?? true));
    });

    return unsubscribe;
  }, []);

  const value = useMemo<SyncIndicatorState>(
    () => ({
      isOnline,
      isSyncing,
      pendingCount,
      label: buildSyncIndicatorLabel(isOnline, isSyncing, pendingCount),
    }),
    [isOnline, isSyncing, pendingCount]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/**
 * Adds a local mutation to the sync queue and notifies status listeners immediately.
 *
 * @param queueEntry - queue record ready to persist
 */
export async function queueLocalSyncMutation(
  queueEntry: Omit<LocalQueueEntry, 'retry_count' | 'last_error'>
) {
  await enqueueLocalSyncMutation(queueEntry);
  notifySyncListeners();
}
