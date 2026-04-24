import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  countUnsyncedQueueEntries,
  enqueueLocalSyncMutation,
  listLocalSyncQueueEntries,
} from '@/services/localData';
import { useAuth } from '@/services/auth';

type SyncIndicatorState = {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  label: string;
};

const SyncContext = createContext<SyncIndicatorState | null>(null);

let onlineState = true;
const syncListeners = new Set<() => void>();

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
 * Placeholder for future queue processing.
 *
 * @param coachId - authenticated coach id
 */
export async function processPendingSyncQueueForCoach(coachId: string) {
  if (coachId) {
    notifySyncListeners();
  }
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

      const [nextCount, syncingEntries] = await Promise.all([
        refreshPendingSyncCount(user.id),
        listLocalSyncQueueEntries(user.id, ['syncing']),
      ]);

      if (isActive) {
        setPendingCount(nextCount);
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
  queueEntry: Parameters<typeof enqueueLocalSyncMutation>[0]
) {
  await enqueueLocalSyncMutation(queueEntry);
  notifySyncListeners();
}
