import { getLocalDatabase } from '@/lib/localDatabase';
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

type LocalPitcherRow = Omit<PitcherProfile, 'pitch_arsenal'> & {
  coach_id: string;
  pitch_arsenal_json: string;
  sync_state: LocalSyncState;
};

type LocalEventRow = ThrowingEvent & {
  coach_id: string;
  sync_state: LocalSyncState;
};

type LocalBreakdownRow = EventPitchBreakdown & {
  coach_id: string;
  sync_state: LocalSyncState;
};

type LocalAssignedWorkoutRow = Omit<AssignedWorkout, 'pitch_mix' | 'work_blocks'> & {
  coach_id: string;
  pitch_mix_json: string;
  work_blocks_json: string;
  sync_state: LocalSyncState;
};

let localWriteChain = Promise.resolve();

function isRecoverableLocalReadError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('no such table') ||
    message.includes('cannot rollback') ||
    message.includes('transaction is active') ||
    message.includes('database schema')
  );
}

async function withLocalReadFallback<T>(
  operationName: string,
  fallbackValue: T,
  operation: () => Promise<T>
) {
  try {
    return await operation();
  } catch (error) {
    if (isRecoverableLocalReadError(error)) {
      return fallbackValue;
    }

    throw new Error(`Local offline read failed in ${operationName}.`, { cause: error });
  }
}

async function withSerializedLocalWrite<T>(
  operationName: string,
  operation: () => Promise<T>
) {
  const run = localWriteChain.then(async () => {
    try {
      return await operation();
    } catch (error) {
      throw new Error(`Local offline write failed in ${operationName}.`, { cause: error });
    }
  });

  localWriteChain = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

function toPitcherRow(
  coachId: string,
  pitcher: PitcherProfile,
  syncState: LocalSyncState
): LocalPitcherRow {
  return {
    ...pitcher,
    coach_id: coachId,
    pitch_arsenal_json: JSON.stringify(pitcher.pitch_arsenal ?? []),
    sync_state: syncState,
  };
}

function fromPitcherRow(row: LocalPitcherRow): PitcherProfile {
  return {
    id: row.id,
    created_by: row.created_by,
    first_name: row.first_name,
    last_name: row.last_name,
    age: row.age,
    grade: row.grade,
    level_team: row.level_team,
    target_game_ready_date: row.target_game_ready_date,
    handedness: row.handedness,
    pitch_arsenal: JSON.parse(row.pitch_arsenal_json ?? '[]'),
    development_phase: row.development_phase,
    primary_goals: row.primary_goals,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toEventRow(
  coachId: string,
  event: ThrowingEvent,
  syncState: LocalSyncState
): LocalEventRow {
  return {
    ...event,
    coach_id: coachId,
    sync_state: syncState,
  };
}

function toBreakdownRow(
  coachId: string,
  row: EventPitchBreakdown,
  syncState: LocalSyncState
): LocalBreakdownRow {
  return {
    ...row,
    coach_id: coachId,
    sync_state: syncState,
  };
}

function toAssignedWorkoutRow(
  coachId: string,
  workout: AssignedWorkout,
  syncState: LocalSyncState
): LocalAssignedWorkoutRow {
  return {
    ...workout,
    coach_id: coachId,
    pitch_mix_json: JSON.stringify(workout.pitch_mix ?? []),
    work_blocks_json: JSON.stringify(workout.work_blocks ?? []),
    sync_state: syncState,
  };
}

function fromAssignedWorkoutRow(row: LocalAssignedWorkoutRow): AssignedWorkout & {
  sync_state?: LocalSyncState;
} {
  return {
    id: row.id,
    pitcher_id: row.pitcher_id,
    assigned_by_user_id: row.assigned_by_user_id,
    planned_date: row.planned_date,
    title: row.title,
    focus: row.focus,
    target_pitch_count: row.target_pitch_count,
    intensity: row.intensity,
    pitch_mix: JSON.parse(row.pitch_mix_json ?? '[]'),
    work_blocks: JSON.parse(row.work_blocks_json ?? '[]'),
    coach_notes: row.coach_notes,
    status: row.status,
    viewed_at: row.viewed_at,
    completed_at: row.completed_at,
    pitcher_feedback: row.pitcher_feedback,
    completed_throwing_event_id: row.completed_throwing_event_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sync_state: row.sync_state,
  };
}

/**
 * Generates a UUID v4 for offline-created records and queue items.
 *
 * Supabase expects UUID primary keys, so locally-created rows must use the same
 * shape before they ever reach SQLite or the sync queue.
 *
 * @param _prefix - legacy debug prefix parameter retained for call-site compatibility
 * @returns validated UUID string suitable for local persistence and later sync
 */
export function generateClientId(_prefix: string) {
  return generateUuid();
}

/** Lists cached pitchers for one coach from SQLite. */
export async function listLocalPitchersForCoach(coachId: string) {
  return withLocalReadFallback('listLocalPitchersForCoach', [] as PitcherProfile[], async () => {
    const db = await getLocalDatabase();
    const rows = await db.getAllAsync<LocalPitcherRow>(
      `
        SELECT *
        FROM local_pitcher_profiles
        WHERE coach_id = ?
        ORDER BY last_name ASC, first_name ASC
      `,
      coachId
    );

    return rows.map(fromPitcherRow);
  });
}

/** Loads one cached pitcher by coach and pitcher id. */
export async function getLocalPitcherByIdForCoach(coachId: string, pitcherId: string) {
  return withLocalReadFallback(
    'getLocalPitcherByIdForCoach',
    null,
    async () => {
      const db = await getLocalDatabase();
      const rows = await db.getAllAsync<LocalPitcherRow>(
        `
          SELECT *
          FROM local_pitcher_profiles
          WHERE coach_id = ? AND id = ?
          LIMIT 1
        `,
        coachId,
        pitcherId
      );

      return rows[0] ? fromPitcherRow(rows[0]) : null;
    }
  );
}

/** Upserts pitcher profiles into the local cache with the given sync state. */
export async function upsertLocalPitchers(
  coachId: string,
  pitchers: PitcherProfile[],
  syncState: LocalSyncState = 'synced'
) {
  await withSerializedLocalWrite('upsertLocalPitchers', async () => {
    const db = await getLocalDatabase();

    await db.withTransactionAsync(async () => {
      for (const pitcher of pitchers) {
        const row = toPitcherRow(coachId, pitcher, syncState);
        await db.runAsync(
          `
            INSERT INTO local_pitcher_profiles (
              id, coach_id, created_by, first_name, last_name, age, grade, level_team,
              target_game_ready_date, handedness, pitch_arsenal_json, development_phase,
              primary_goals, notes, created_at, updated_at, sync_state
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              coach_id = excluded.coach_id,
              created_by = excluded.created_by,
              first_name = excluded.first_name,
              last_name = excluded.last_name,
              age = excluded.age,
              grade = excluded.grade,
              level_team = excluded.level_team,
              target_game_ready_date = excluded.target_game_ready_date,
              handedness = excluded.handedness,
              pitch_arsenal_json = excluded.pitch_arsenal_json,
              development_phase = excluded.development_phase,
              primary_goals = excluded.primary_goals,
              notes = excluded.notes,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              sync_state = excluded.sync_state
          `,
          row.id,
          row.coach_id,
          row.created_by,
          row.first_name,
          row.last_name,
          row.age,
          row.grade,
          row.level_team,
          row.target_game_ready_date,
          row.handedness,
          row.pitch_arsenal_json,
          row.development_phase,
          row.primary_goals,
          row.notes,
          row.created_at,
          row.updated_at,
          row.sync_state
        );
      }
    });
  });
}

/** Upserts a single pitcher profile into the local cache. */
export async function upsertLocalPitcher(
  coachId: string,
  pitcher: PitcherProfile,
  syncState: LocalSyncState = 'synced'
) {
  await upsertLocalPitchers(coachId, [pitcher], syncState);
}

/** Updates the sync marker for one cached pitcher record. */
export async function updateLocalPitcherSyncState(pitcherId: string, syncState: LocalSyncState) {
  await withSerializedLocalWrite('updateLocalPitcherSyncState', async () => {
    const db = await getLocalDatabase();
    await db.runAsync(
      `UPDATE local_pitcher_profiles SET sync_state = ? WHERE id = ?`,
      syncState,
      pitcherId
    );
  });
}

/** Lists cached throwing events across a coach's staff. */
export async function listLocalThrowingEventsForCoach(coachId: string, limit = 200) {
  return withLocalReadFallback(
    'listLocalThrowingEventsForCoach',
    [] as ThrowingEvent[],
    async () => {
      const db = await getLocalDatabase();
      return db.getAllAsync<ThrowingEvent>(
        `
          SELECT id, pitcher_id, date, event_type, total_pitches, innings_thrown, intensity,
                 arm_feel, bullpen_focus, notes, entered_by_user_id, source_type, created_at, updated_at
          FROM local_throwing_events
          WHERE coach_id = ?
          ORDER BY date DESC, created_at DESC
          LIMIT ?
        `,
        coachId,
        limit
      );
    }
  );
}

/** Lists cached throwing events for one pitcher. */
export async function listLocalThrowingEventsForPitcher(
  coachId: string,
  pitcherId: string,
  limit = 10
) {
  return withLocalReadFallback(
    'listLocalThrowingEventsForPitcher',
    [] as ThrowingEvent[],
    async () => {
      const db = await getLocalDatabase();
      return db.getAllAsync<ThrowingEvent>(
        `
          SELECT id, pitcher_id, date, event_type, total_pitches, innings_thrown, intensity,
                 arm_feel, bullpen_focus, notes, entered_by_user_id, source_type, created_at, updated_at
          FROM local_throwing_events
          WHERE coach_id = ? AND pitcher_id = ?
          ORDER BY date DESC, created_at DESC
          LIMIT ?
        `,
        coachId,
        pitcherId,
        limit
      );
    }
  );
}

/** Upserts throwing events into the local cache. */
export async function upsertLocalThrowingEvents(
  coachId: string,
  events: ThrowingEvent[],
  syncState: LocalSyncState = 'synced'
) {
  await withSerializedLocalWrite('upsertLocalThrowingEvents', async () => {
    const db = await getLocalDatabase();

    await db.withTransactionAsync(async () => {
      for (const event of events) {
        const row = toEventRow(coachId, event, syncState);
        await db.runAsync(
          `
            INSERT INTO local_throwing_events (
              id, coach_id, pitcher_id, date, event_type, total_pitches, innings_thrown,
              intensity, arm_feel, bullpen_focus, notes, entered_by_user_id, source_type,
              created_at, updated_at, sync_state
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              coach_id = excluded.coach_id,
              pitcher_id = excluded.pitcher_id,
              date = excluded.date,
              event_type = excluded.event_type,
              total_pitches = excluded.total_pitches,
              innings_thrown = excluded.innings_thrown,
              intensity = excluded.intensity,
              arm_feel = excluded.arm_feel,
              bullpen_focus = excluded.bullpen_focus,
              notes = excluded.notes,
              entered_by_user_id = excluded.entered_by_user_id,
              source_type = excluded.source_type,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              sync_state = excluded.sync_state
          `,
          row.id,
          row.coach_id,
          row.pitcher_id,
          row.date,
          row.event_type,
          row.total_pitches,
          row.innings_thrown,
          row.intensity,
          row.arm_feel,
          row.bullpen_focus,
          row.notes,
          row.entered_by_user_id,
          row.source_type,
          row.created_at,
          row.updated_at,
          row.sync_state
        );
      }
    });
  });
}

/** Upserts a single throwing event into the local cache. */
export async function upsertLocalThrowingEvent(
  coachId: string,
  event: ThrowingEvent,
  syncState: LocalSyncState = 'synced'
) {
  await upsertLocalThrowingEvents(coachId, [event], syncState);
}

/** Updates the sync marker for one cached throwing event. */
export async function updateLocalThrowingEventSyncState(
  eventId: string,
  syncState: LocalSyncState
) {
  await withSerializedLocalWrite('updateLocalThrowingEventSyncState', async () => {
    const db = await getLocalDatabase();
    await db.runAsync(
      `UPDATE local_throwing_events SET sync_state = ? WHERE id = ?`,
      syncState,
      eventId
    );
  });
}

/**
 * Replaces all local pitch-breakdown rows for one event.
 *
 * This is used when the latest known state should fully overwrite the cached child rows.
 */
export async function replaceLocalPitchBreakdownForEvent(
  coachId: string,
  eventId: string,
  rows: EventPitchBreakdown[],
  syncState: LocalSyncState = 'synced'
) {
  await withSerializedLocalWrite('replaceLocalPitchBreakdownForEvent', async () => {
    const db = await getLocalDatabase();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `DELETE FROM local_event_pitch_breakdown WHERE coach_id = ? AND event_id = ?`,
        coachId,
        eventId
      );

      for (const row of rows) {
        const nextRow = toBreakdownRow(coachId, row, syncState);
        await db.runAsync(
          `
            INSERT INTO local_event_pitch_breakdown (
              id, coach_id, event_id, pitch_type, pitch_count, sync_state
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              coach_id = excluded.coach_id,
              event_id = excluded.event_id,
              pitch_type = excluded.pitch_type,
              pitch_count = excluded.pitch_count,
              sync_state = excluded.sync_state
          `,
          nextRow.id,
          nextRow.coach_id,
          nextRow.event_id,
          nextRow.pitch_type,
          nextRow.pitch_count,
          nextRow.sync_state
        );
      }
    });
  });
}

/** Upserts pitch-breakdown rows into the local cache. */
export async function upsertLocalPitchBreakdownRows(
  coachId: string,
  rows: EventPitchBreakdown[],
  syncState: LocalSyncState = 'synced'
) {
  await withSerializedLocalWrite('upsertLocalPitchBreakdownRows', async () => {
    const db = await getLocalDatabase();

    await db.withTransactionAsync(async () => {
      for (const row of rows) {
        const nextRow = toBreakdownRow(coachId, row, syncState);
        await db.runAsync(
          `
            INSERT INTO local_event_pitch_breakdown (
              id, coach_id, event_id, pitch_type, pitch_count, sync_state
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              coach_id = excluded.coach_id,
              event_id = excluded.event_id,
              pitch_type = excluded.pitch_type,
              pitch_count = excluded.pitch_count,
              sync_state = excluded.sync_state
          `,
          nextRow.id,
          nextRow.coach_id,
          nextRow.event_id,
          nextRow.pitch_type,
          nextRow.pitch_count,
          nextRow.sync_state
        );
      }
    });
  });
}

/** Lists cached pitch-breakdown rows for a set of event ids. */
export async function listLocalPitchBreakdownForEventIds(
  coachId: string,
  eventIds: string[]
) {
  if (!eventIds.length) {
    return [] as EventPitchBreakdown[];
  }

  return withLocalReadFallback(
    'listLocalPitchBreakdownForEventIds',
    [] as EventPitchBreakdown[],
    async () => {
      const db = await getLocalDatabase();
      const placeholders = eventIds.map(() => '?').join(', ');
      return db.getAllAsync<EventPitchBreakdown>(
        `
          SELECT id, event_id, pitch_type, pitch_count
          FROM local_event_pitch_breakdown
          WHERE coach_id = ? AND event_id IN (${placeholders})
          ORDER BY pitch_type ASC
        `,
        coachId,
        ...eventIds
      );
    }
  );
}

/** Updates the sync marker for one cached pitch-breakdown row. */
export async function updateLocalPitchBreakdownSyncState(
  breakdownId: string,
  syncState: LocalSyncState
) {
  await withSerializedLocalWrite('updateLocalPitchBreakdownSyncState', async () => {
    const db = await getLocalDatabase();
    await db.runAsync(
      `UPDATE local_event_pitch_breakdown SET sync_state = ? WHERE id = ?`,
      syncState,
      breakdownId
    );
  });
}

/** Lists cached assigned workouts for one owner and optional pitcher scope. */
export async function listLocalAssignedWorkouts(
  coachId: string,
  pitcherId?: string
) {
  return withLocalReadFallback(
    'listLocalAssignedWorkouts',
    [] as Array<AssignedWorkout & { sync_state?: LocalSyncState }>,
    async () => {
      const db = await getLocalDatabase();

      if (pitcherId) {
        const rows = await db.getAllAsync<LocalAssignedWorkoutRow>(
          `
            SELECT *
            FROM local_assigned_workouts
            WHERE coach_id = ? AND pitcher_id = ?
            ORDER BY planned_date ASC, created_at DESC
          `,
          coachId,
          pitcherId
        );

        return rows.map(fromAssignedWorkoutRow);
      }

      const rows = await db.getAllAsync<LocalAssignedWorkoutRow>(
        `
          SELECT *
          FROM local_assigned_workouts
          WHERE coach_id = ?
          ORDER BY planned_date ASC, created_at DESC
        `,
        coachId
      );

      return rows.map(fromAssignedWorkoutRow);
    }
  );
}

/** Loads one cached assigned workout for one owner. */
export async function getLocalAssignedWorkoutById(
  coachId: string,
  workoutId: string
) {
  return withLocalReadFallback(
    'getLocalAssignedWorkoutById',
    null as (AssignedWorkout & { sync_state?: LocalSyncState }) | null,
    async () => {
      const db = await getLocalDatabase();
      const rows = await db.getAllAsync<LocalAssignedWorkoutRow>(
        `
          SELECT *
          FROM local_assigned_workouts
          WHERE coach_id = ? AND id = ?
          LIMIT 1
        `,
        coachId,
        workoutId
      );

      return rows[0] ? fromAssignedWorkoutRow(rows[0]) : null;
    }
  );
}

/** Replaces all cached assigned workouts for one owner/pitcher scope. */
export async function replaceLocalAssignedWorkoutsForPitcher(
  coachId: string,
  pitcherId: string,
  workouts: AssignedWorkout[],
  syncState: LocalSyncState = 'synced'
) {
  await withSerializedLocalWrite('replaceLocalAssignedWorkoutsForPitcher', async () => {
    const db = await getLocalDatabase();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `DELETE FROM local_assigned_workouts WHERE coach_id = ? AND pitcher_id = ?`,
        coachId,
        pitcherId
      );

      for (const workout of workouts) {
        const row = toAssignedWorkoutRow(coachId, workout, syncState);
        await db.runAsync(
          `
            INSERT INTO local_assigned_workouts (
              id, coach_id, pitcher_id, assigned_by_user_id, planned_date, title, focus,
              target_pitch_count, intensity, pitch_mix_json, work_blocks_json, coach_notes,
              status, viewed_at, completed_at, pitcher_feedback, completed_throwing_event_id,
              created_at, updated_at, sync_state
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              coach_id = excluded.coach_id,
              pitcher_id = excluded.pitcher_id,
              assigned_by_user_id = excluded.assigned_by_user_id,
              planned_date = excluded.planned_date,
              title = excluded.title,
              focus = excluded.focus,
              target_pitch_count = excluded.target_pitch_count,
              intensity = excluded.intensity,
              pitch_mix_json = excluded.pitch_mix_json,
              work_blocks_json = excluded.work_blocks_json,
              coach_notes = excluded.coach_notes,
              status = excluded.status,
              viewed_at = excluded.viewed_at,
              completed_at = excluded.completed_at,
              pitcher_feedback = excluded.pitcher_feedback,
              completed_throwing_event_id = excluded.completed_throwing_event_id,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              sync_state = excluded.sync_state
          `,
          row.id,
          row.coach_id,
          row.pitcher_id,
          row.assigned_by_user_id,
          row.planned_date,
          row.title,
          row.focus,
          row.target_pitch_count,
          row.intensity,
          row.pitch_mix_json,
          row.work_blocks_json,
          row.coach_notes,
          row.status,
          row.viewed_at,
          row.completed_at,
          row.pitcher_feedback,
          row.completed_throwing_event_id,
          row.created_at,
          row.updated_at,
          row.sync_state
        );
      }
    });
  });
}

/** Upserts assigned workouts into the local cache. */
export async function upsertLocalAssignedWorkouts(
  coachId: string,
  workouts: AssignedWorkout[],
  syncState: LocalSyncState = 'synced'
) {
  await withSerializedLocalWrite('upsertLocalAssignedWorkouts', async () => {
    const db = await getLocalDatabase();

    await db.withTransactionAsync(async () => {
      for (const workout of workouts) {
        const row = toAssignedWorkoutRow(coachId, workout, syncState);
        await db.runAsync(
          `
            INSERT INTO local_assigned_workouts (
              id, coach_id, pitcher_id, assigned_by_user_id, planned_date, title, focus,
              target_pitch_count, intensity, pitch_mix_json, work_blocks_json, coach_notes,
              status, viewed_at, completed_at, pitcher_feedback, completed_throwing_event_id,
              created_at, updated_at, sync_state
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              coach_id = excluded.coach_id,
              pitcher_id = excluded.pitcher_id,
              assigned_by_user_id = excluded.assigned_by_user_id,
              planned_date = excluded.planned_date,
              title = excluded.title,
              focus = excluded.focus,
              target_pitch_count = excluded.target_pitch_count,
              intensity = excluded.intensity,
              pitch_mix_json = excluded.pitch_mix_json,
              work_blocks_json = excluded.work_blocks_json,
              coach_notes = excluded.coach_notes,
              status = excluded.status,
              viewed_at = excluded.viewed_at,
              completed_at = excluded.completed_at,
              pitcher_feedback = excluded.pitcher_feedback,
              completed_throwing_event_id = excluded.completed_throwing_event_id,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              sync_state = excluded.sync_state
          `,
          row.id,
          row.coach_id,
          row.pitcher_id,
          row.assigned_by_user_id,
          row.planned_date,
          row.title,
          row.focus,
          row.target_pitch_count,
          row.intensity,
          row.pitch_mix_json,
          row.work_blocks_json,
          row.coach_notes,
          row.status,
          row.viewed_at,
          row.completed_at,
          row.pitcher_feedback,
          row.completed_throwing_event_id,
          row.created_at,
          row.updated_at,
          row.sync_state
        );
      }
    });
  });
}

/** Upserts a single assigned workout into the local cache. */
export async function upsertLocalAssignedWorkout(
  coachId: string,
  workout: AssignedWorkout,
  syncState: LocalSyncState = 'synced'
) {
  await upsertLocalAssignedWorkouts(coachId, [workout], syncState);
}

/** Updates the sync marker for one cached assigned workout. */
export async function updateLocalAssignedWorkoutSyncState(
  workoutId: string,
  syncState: LocalSyncState
) {
  await withSerializedLocalWrite('updateLocalAssignedWorkoutSyncState', async () => {
    const db = await getLocalDatabase();
    await db.runAsync(
      `UPDATE local_assigned_workouts SET sync_state = ? WHERE id = ?`,
      syncState,
      workoutId
    );
  });
}

/**
 * Adds a mutation to the local sync queue.
 *
 * Queue records preserve write intent while the app is offline or waiting to retry.
 */
export async function enqueueLocalSyncMutation(
  entry: Omit<LocalQueueEntry, 'retry_count' | 'last_error'>
) {
  await withSerializedLocalWrite('enqueueLocalSyncMutation', async () => {
    const db = await getLocalDatabase();
    await db.runAsync(
      `
        INSERT INTO local_sync_queue (
          id, coach_id, mutation_type, entity_id, payload_json, status,
          retry_count, last_error, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
      `,
      entry.id,
      entry.coach_id,
      entry.mutation_type,
      entry.entity_id,
      entry.payload_json,
      entry.status,
      entry.created_at,
      entry.updated_at
    );
  });
}

/** Lists queued mutations for a coach, ordered oldest-first for deterministic replay. */
export async function listLocalSyncQueueEntries(
  coachId: string,
  statuses: LocalSyncState[] = ['pending', 'failed', 'syncing']
) {
  if (!statuses.length) {
    return [] as LocalQueueEntry[];
  }

  return withLocalReadFallback(
    'listLocalSyncQueueEntries',
    [] as LocalQueueEntry[],
    async () => {
      const db = await getLocalDatabase();
      const placeholders = statuses.map(() => '?').join(', ');

      return db.getAllAsync<LocalQueueEntry>(
        `
          SELECT *
          FROM local_sync_queue
          WHERE coach_id = ? AND status IN (${placeholders})
          ORDER BY created_at ASC, rowid ASC
        `,
        coachId,
        ...statuses
      );
    }
  );
}

/** Updates queue status, retry count, and latest error state for one mutation. */
export async function updateLocalSyncQueueEntry(
  queueId: string,
  status: LocalSyncState,
  lastError: string | null = null,
  retryCount?: number
) {
  await withSerializedLocalWrite('updateLocalSyncQueueEntry', async () => {
    const db = await getLocalDatabase();
    const updatedAt = new Date().toISOString();

    if (typeof retryCount === 'number') {
      await db.runAsync(
        `
          UPDATE local_sync_queue
          SET status = ?, last_error = ?, retry_count = ?, updated_at = ?
          WHERE id = ?
        `,
        status,
        lastError,
        retryCount,
        updatedAt,
        queueId
      );
      return;
    }

    await db.runAsync(
      `
        UPDATE local_sync_queue
        SET status = ?, last_error = ?, updated_at = ?
        WHERE id = ?
      `,
      status,
      lastError,
      updatedAt,
      queueId
    );
  });
}

/** Counts queue entries that still need sync work for one coach. */
export async function countUnsyncedQueueEntries(coachId: string) {
  return withLocalReadFallback('countUnsyncedQueueEntries', 0, async () => {
    const db = await getLocalDatabase();
    const rows = await db.getAllAsync<{ count: number }>(
      `
        SELECT COUNT(*) as count
        FROM local_sync_queue
        WHERE coach_id = ? AND status != 'synced'
      `,
      coachId
    );

    return rows[0]?.count ?? 0;
  });
}

/**
 * Clears all local offline cache and queue tables on this device.
 *
 * This does not touch any Supabase data. It is used both for development
 * resets and for explicit coach sign-out so prior cached data does not remain
 * on the device longer than necessary.
 *
 * @returns promise that resolves when all local offline tables are cleared
 */
export async function clearLocalOfflineData() {
  await withSerializedLocalWrite('clearLocalOfflineData', async () => {
    const db = await getLocalDatabase();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`DELETE FROM local_sync_queue`);
      await db.runAsync(`DELETE FROM local_assigned_workouts`);
      await db.runAsync(`DELETE FROM local_event_pitch_breakdown`);
      await db.runAsync(`DELETE FROM local_throwing_events`);
      await db.runAsync(`DELETE FROM local_pitcher_profiles`);
      await db.runAsync(`DELETE FROM sync_queue`);
      await db.runAsync(`DELETE FROM cached_assigned_workouts`);
      await db.runAsync(`DELETE FROM cached_event_pitch_breakdown`);
      await db.runAsync(`DELETE FROM cached_throwing_events`);
      await db.runAsync(`DELETE FROM cached_pitcher_profiles`);
    });
  });
}

/**
 * Backward-compatible alias for development reset flows.
 *
 * @returns promise that resolves when all local offline tables are cleared
 */
export async function resetLocalOfflineData() {
  await clearLocalOfflineData();
}
