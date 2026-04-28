import {
  AssignedWorkout,
  EventPitchBreakdown,
  PitcherProfile,
  ThrowingEvent,
} from '@/types/models';
import { generateUuid } from '@/utils/ids';

export type LocalSyncState = 'pending' | 'syncing' | 'failed' | 'synced';

export type LocalQueueMutationType =
  | 'create_pitcher'
  | 'update_pitcher'
  | 'create_throwing_event'
  | 'create_pitch_breakdown'
  | 'update_assigned_workout';

export type LocalQueueEntry = {
  id: string;
  coach_id: string;
  mutation_type: LocalQueueMutationType;
  entity_id: string;
  payload_json: string;
  status: LocalSyncState;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const pitchers = new Map<string, PitcherProfile>();
const pitcherCoachIds = new Map<string, string>();
const events = new Map<string, ThrowingEvent>();
const eventCoachIds = new Map<string, string>();
const breakdownRows = new Map<string, EventPitchBreakdown>();
const breakdownCoachIds = new Map<string, string>();
const workouts = new Map<string, AssignedWorkout & { sync_state?: LocalSyncState }>();
const workoutCoachIds = new Map<string, string>();
const queue = new Map<string, LocalQueueEntry>();

/** Generates a UUID v4 for offline-created records in the web shim. */
export function generateClientId(_prefix: string) {
  return generateUuid();
}

/** Lists cached pitchers for one coach in the web fallback store. */
export async function listLocalPitchersForCoach(coachId: string) {
  return Array.from(pitchers.values())
    .filter((pitcher) => pitcherCoachIds.get(pitcher.id) === coachId)
    .sort((left, right) =>
      `${left.last_name}${left.first_name}`.localeCompare(`${right.last_name}${right.first_name}`)
    );
}

/** Loads one cached pitcher from the web fallback store. */
export async function getLocalPitcherByIdForCoach(coachId: string, pitcherId: string) {
  const pitcher = pitchers.get(pitcherId);
  return pitcher && pitcherCoachIds.get(pitcherId) === coachId ? pitcher : null;
}

/** Upserts pitcher profiles into the web fallback store. */
export async function upsertLocalPitchers(
  coachId: string,
  nextPitchers: PitcherProfile[],
  _syncState: LocalSyncState = 'synced'
) {
  nextPitchers.forEach((pitcher) => {
    pitchers.set(pitcher.id, pitcher);
    pitcherCoachIds.set(pitcher.id, coachId);
  });
}

/** Upserts a single pitcher profile into the web fallback store. */
export async function upsertLocalPitcher(
  coachId: string,
  pitcher: PitcherProfile,
  syncState: LocalSyncState = 'synced'
) {
  await upsertLocalPitchers(coachId, [pitcher], syncState);
}

/** No-op sync-state update for the web fallback store. */
export async function updateLocalPitcherSyncState(_pitcherId: string, _syncState: LocalSyncState) {}

/** Lists cached throwing events across a coach's staff in the web fallback store. */
export async function listLocalThrowingEventsForCoach(coachId: string, limit = 200) {
  return Array.from(events.values())
    .filter((event) => eventCoachIds.get(event.id) === coachId)
    .sort((left, right) =>
      `${right.date}${right.created_at}`.localeCompare(`${left.date}${left.created_at}`)
    )
    .slice(0, limit);
}

/** Lists cached throwing events for one pitcher in the web fallback store. */
export async function listLocalThrowingEventsForPitcher(
  coachId: string,
  pitcherId: string,
  limit = 10
) {
  return Array.from(events.values())
    .filter(
      (event) => eventCoachIds.get(event.id) === coachId && event.pitcher_id === pitcherId
    )
    .sort((left, right) =>
      `${right.date}${right.created_at}`.localeCompare(`${left.date}${left.created_at}`)
    )
    .slice(0, limit);
}

/** Upserts throwing events into the web fallback store. */
export async function upsertLocalThrowingEvents(
  coachId: string,
  nextEvents: ThrowingEvent[],
  _syncState: LocalSyncState = 'synced'
) {
  nextEvents.forEach((event) => {
    events.set(event.id, event);
    eventCoachIds.set(event.id, coachId);
  });
}

/** Upserts a single throwing event into the web fallback store. */
export async function upsertLocalThrowingEvent(
  coachId: string,
  event: ThrowingEvent,
  syncState: LocalSyncState = 'synced'
) {
  await upsertLocalThrowingEvents(coachId, [event], syncState);
}

/** No-op throwing-event sync-state update for the web fallback store. */
export async function updateLocalThrowingEventSyncState(
  _eventId: string,
  _syncState: LocalSyncState
) {}

/** Replaces cached pitch-breakdown rows for one event in the web fallback store. */
export async function replaceLocalPitchBreakdownForEvent(
  coachId: string,
  eventId: string,
  rows: EventPitchBreakdown[],
  syncState: LocalSyncState = 'synced'
) {
  Array.from(breakdownRows.values())
    .filter((row) => row.event_id === eventId)
    .forEach((row) => {
      breakdownRows.delete(row.id);
      breakdownCoachIds.delete(row.id);
    });

  await upsertLocalPitchBreakdownRows(coachId, rows, syncState);
}

/** Upserts pitch-breakdown rows into the web fallback store. */
export async function upsertLocalPitchBreakdownRows(
  coachId: string,
  rows: EventPitchBreakdown[],
  _syncState: LocalSyncState = 'synced'
) {
  rows.forEach((row) => {
    breakdownRows.set(row.id, row);
    breakdownCoachIds.set(row.id, coachId);
  });
}

/** Lists cached pitch-breakdown rows for event ids in the web fallback store. */
export async function listLocalPitchBreakdownForEventIds(
  coachId: string,
  eventIds: string[]
) {
  return Array.from(breakdownRows.values()).filter(
    (row) => breakdownCoachIds.get(row.id) === coachId && eventIds.includes(row.event_id)
  );
}

/** No-op pitch-breakdown sync-state update for the web fallback store. */
export async function updateLocalPitchBreakdownSyncState(
  _breakdownId: string,
  _syncState: LocalSyncState
) {}

/** Lists cached assigned workouts in the web fallback store. */
export async function listLocalAssignedWorkouts(coachId: string, pitcherId?: string) {
  return Array.from(workouts.values())
    .filter(
      (workout) =>
        workoutCoachIds.get(workout.id) === coachId &&
        (!pitcherId || workout.pitcher_id === pitcherId)
    )
    .sort((left, right) => {
      const dateCompare = left.planned_date.localeCompare(right.planned_date);

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return right.created_at.localeCompare(left.created_at);
    });
}

/** Loads one cached assigned workout in the web fallback store. */
export async function getLocalAssignedWorkoutById(coachId: string, workoutId: string) {
  const workout = workouts.get(workoutId);
  return workout && workoutCoachIds.get(workoutId) === coachId ? workout : null;
}

/** Replaces cached assigned workouts for one pitcher in the web fallback store. */
export async function replaceLocalAssignedWorkoutsForPitcher(
  coachId: string,
  pitcherId: string,
  nextWorkouts: AssignedWorkout[],
  syncState: LocalSyncState = 'synced'
) {
  Array.from(workouts.values())
    .filter(
      (workout) => workoutCoachIds.get(workout.id) === coachId && workout.pitcher_id === pitcherId
    )
    .forEach((workout) => {
      workouts.delete(workout.id);
      workoutCoachIds.delete(workout.id);
    });

  await upsertLocalAssignedWorkouts(coachId, nextWorkouts, syncState);
}

/** Upserts assigned workouts into the web fallback store. */
export async function upsertLocalAssignedWorkouts(
  coachId: string,
  nextWorkouts: AssignedWorkout[],
  syncState: LocalSyncState = 'synced'
) {
  nextWorkouts.forEach((workout) => {
    workouts.set(workout.id, { ...workout, sync_state: syncState });
    workoutCoachIds.set(workout.id, coachId);
  });
}

/** Upserts one assigned workout into the web fallback store. */
export async function upsertLocalAssignedWorkout(
  coachId: string,
  workout: AssignedWorkout,
  syncState: LocalSyncState = 'synced'
) {
  await upsertLocalAssignedWorkouts(coachId, [workout], syncState);
}

/** Updates the sync-state marker for one cached workout in the web fallback store. */
export async function updateLocalAssignedWorkoutSyncState(
  workoutId: string,
  syncState: LocalSyncState
) {
  const workout = workouts.get(workoutId);

  if (!workout) {
    return;
  }

  workouts.set(workoutId, { ...workout, sync_state: syncState });
}

/** Adds a mutation to the in-memory web fallback queue. */
export async function enqueueLocalSyncMutation(
  entry: Omit<LocalQueueEntry, 'retry_count' | 'last_error'>
) {
  queue.set(entry.id, {
    ...entry,
    retry_count: 0,
    last_error: null,
  });
}

/** Lists queued mutations from the in-memory web fallback queue. */
export async function listLocalSyncQueueEntries(
  coachId: string,
  statuses: LocalSyncState[] = ['pending', 'failed', 'syncing']
) {
  return Array.from(queue.values())
    .filter((entry) => entry.coach_id === coachId && statuses.includes(entry.status))
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

/** Updates one queued mutation in the in-memory web fallback queue. */
export async function updateLocalSyncQueueEntry(
  queueId: string,
  status: LocalSyncState,
  lastError: string | null = null,
  retryCount?: number
) {
  const existing = queue.get(queueId);

  if (!existing) {
    return;
  }

  queue.set(queueId, {
    ...existing,
    status,
    last_error: lastError,
    retry_count: typeof retryCount === 'number' ? retryCount : existing.retry_count,
    updated_at: new Date().toISOString(),
  });
}

/** Counts unsynced queue entries in the web fallback store. */
export async function countUnsyncedQueueEntries(coachId: string) {
  return Array.from(queue.values()).filter(
    (entry) => entry.coach_id === coachId && entry.status !== 'synced'
  ).length;
}

/**
 * Clears all local offline cache and queue state in the web shim.
 */
export async function clearLocalOfflineData() {
  pitchers.clear();
  pitcherCoachIds.clear();
  events.clear();
  eventCoachIds.clear();
  breakdownRows.clear();
  breakdownCoachIds.clear();
  workouts.clear();
  workoutCoachIds.clear();
  queue.clear();
}

export async function resetLocalOfflineData() {
  await clearLocalOfflineData();
}
