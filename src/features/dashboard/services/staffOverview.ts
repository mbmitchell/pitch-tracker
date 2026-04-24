import {
  buildPitcherStaffOverview,
  PitcherStaffOverview,
} from '@/features/dashboard/utils/staffOverview';
import { listThrowingEventsForCoach } from '@/services/events';
import { listPitchersForCoach } from '@/services/pitchers';

function isLocalCacheError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('local offline') ||
    message.includes('sqlite') ||
    message.includes('cannot rollback') ||
    message.includes('transaction is active') ||
    message.includes('database')
  );
}

/**
 * Loads the shared staff overview collection used by dashboard and readiness drill-down views.
 *
 * The loader keeps roster and workload fetching in one place so both screens
 * get the same data shape and fallback behavior.
 *
 * @param coachId - authenticated coach id
 * @returns derived staff overview rows for dashboard-style UI
 */
export async function loadStaffOverviewForCoach(coachId: string) {
  const [pitchers, events] = await Promise.all([
    listPitchersForCoach(coachId),
    listThrowingEventsForCoach(coachId),
  ]);

  return buildPitcherStaffOverview(pitchers, events);
}

/**
 * Maps internal load failures to coach-friendly dashboard/readiness error copy.
 *
 * Raw SQLite and local cache errors should not be shown directly in the UI,
 * especially when the app is offline and the cache layer is temporarily unavailable.
 *
 * @param error - thrown loader error
 * @param isOnline - current connectivity state
 * @returns sanitized user-facing error message
 */
export function getStaffOverviewLoadErrorMessage(error: unknown, isOnline: boolean) {
  if (isLocalCacheError(error)) {
    return isOnline
      ? 'Staff overview could not refresh local cached data right now. Try again in a moment.'
      : 'Offline data is temporarily unavailable on this device. Reconnect and try again, or restart the app if the problem continues.';
  }

  if (error instanceof Error && error.message.trim()) {
    return isOnline
      ? 'Unable to load staff overview right now. Try again in a moment.'
      : 'Unable to load staff overview while offline.';
  }

  return isOnline
    ? 'Unable to load staff overview right now.'
    : 'Unable to load staff overview while offline.';
}
