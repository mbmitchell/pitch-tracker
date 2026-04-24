import {
  getLocalDatabase,
  initializeOfflineDatabase,
} from '@/lib/localDatabase';
import {
  EventPitchBreakdown,
  PitcherProfile,
  ThrowingEvent,
} from '@/types/models';

import {
  CachedEventPitchBreakdownRow,
  CachedPitcherProfileRow,
  CachedThrowingEventRow,
  EnqueueOfflineMutationInput,
  OfflineSyncQueueRecord,
  OfflineSyncQueueStatus,
} from './types';

function nowIsoString() {
  return new Date().toISOString();
}

function createUuidSegment(length: number) {
  return Array.from({ length }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Generates a UUID-like client id for offline-created rows and queue entries.
 *
 * This keeps ids stable before cloud sync without adding another dependency.
 *
 * @returns locally generated UUID string
 */
export function generateOfflineUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${createUuidSegment(8)}-${createUuidSegment(4)}-4${createUuidSegment(
    3
  )}-a${createUuidSegment(3)}-${createUuidSegment(12)}`;
}

function toCachedPitcherRow(
  coachId: string,
  pitcher: PitcherProfile
): CachedPitcherProfileRow {
  return {
    ...pitcher,
    coach_id: coachId,
    pitch_arsenal_json: JSON.stringify(pitcher.pitch_arsenal ?? []),
  };
}

function fromCachedPitcherRow(row: CachedPitcherProfileRow): PitcherProfile {
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

function toCachedEventRow(
  coachId: string,
  event: ThrowingEvent
): CachedThrowingEventRow {
  return {
    ...event,
    coach_id: coachId,
  };
}

function toCachedBreakdownRow(
  coachId: string,
  row: EventPitchBreakdown
): CachedEventPitchBreakdownRow {
  return {
    ...row,
    coach_id: coachId,
  };
}

/**
 * Initializes the requested Phase 1 offline schema.
 *
 * @returns ready SQLite database instance
 */
export async function initializeOfflineRepository() {
  return initializeOfflineDatabase();
}

/**
 * Reads cached pitcher profiles for one signed-in coach.
 *
 * @param coachId - authenticated coach id
 * @returns cached roster rows ordered for coach workflows
 */
export async function listCachedPitcherProfilesForCoach(coachId: string) {
  const db = await getLocalDatabase();
  const rows = await db.getAllAsync<CachedPitcherProfileRow>(
    `
      SELECT *
      FROM cached_pitcher_profiles
      WHERE coach_id = ?
      ORDER BY last_name ASC, first_name ASC
    `,
    coachId
  );

  return rows.map(fromCachedPitcherRow);
}

/**
 * Upserts cloud-backed pitcher profiles into the offline cache.
 *
 * @param coachId - authenticated coach id
 * @param pitchers - latest pulled or locally created pitcher profiles
 */
export async function upsertCachedPitcherProfiles(
  coachId: string,
  pitchers: PitcherProfile[]
) {
  const db = await getLocalDatabase();

  await db.withTransactionAsync(async () => {
    for (const pitcher of pitchers) {
      const row = toCachedPitcherRow(coachId, pitcher);

      await db.runAsync(
        `
          INSERT INTO cached_pitcher_profiles (
            id, coach_id, created_by, first_name, last_name, age, grade, level_team,
            target_game_ready_date, handedness, pitch_arsenal_json, development_phase,
            primary_goals, notes, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            updated_at = excluded.updated_at
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
        row.updated_at
      );
    }
  });
}

/**
 * Reads cached throwing events for a coach.
 *
 * @param coachId - authenticated coach id
 * @param limit - max rows to return
 * @returns coach-scoped cached events ordered by recency
 */
export async function listCachedThrowingEventsForCoach(coachId: string, limit = 200) {
  const db = await getLocalDatabase();
  return db.getAllAsync<ThrowingEvent>(
    `
      SELECT id, pitcher_id, date, event_type, total_pitches, innings_thrown, intensity,
             arm_feel, bullpen_focus, notes, entered_by_user_id, source_type, created_at, updated_at
      FROM cached_throwing_events
      WHERE coach_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT ?
    `,
    coachId,
    limit
  );
}

/**
 * Upserts throwing events into the offline cache.
 *
 * @param coachId - authenticated coach id
 * @param events - latest pulled or locally created throwing events
 */
export async function upsertCachedThrowingEvents(
  coachId: string,
  events: ThrowingEvent[]
) {
  const db = await getLocalDatabase();

  await db.withTransactionAsync(async () => {
    for (const event of events) {
      const row = toCachedEventRow(coachId, event);

      await db.runAsync(
        `
          INSERT INTO cached_throwing_events (
            id, coach_id, pitcher_id, date, event_type, total_pitches, innings_thrown,
            intensity, arm_feel, bullpen_focus, notes, entered_by_user_id, source_type,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            updated_at = excluded.updated_at
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
        row.updated_at
      );
    }
  });
}

/**
 * Replaces cached pitch-breakdown rows for one event.
 *
 * @param coachId - authenticated coach id
 * @param eventId - parent event id
 * @param rows - latest breakdown rows for the event
 */
export async function replaceCachedPitchBreakdownForEvent(
  coachId: string,
  eventId: string,
  rows: EventPitchBreakdown[]
) {
  const db = await getLocalDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM cached_event_pitch_breakdown WHERE coach_id = ? AND event_id = ?`,
      coachId,
      eventId
    );

    for (const row of rows) {
      const nextRow = toCachedBreakdownRow(coachId, row);

      await db.runAsync(
        `
          INSERT INTO cached_event_pitch_breakdown (
            id, coach_id, event_id, pitch_type, pitch_count
          )
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            coach_id = excluded.coach_id,
            event_id = excluded.event_id,
            pitch_type = excluded.pitch_type,
            pitch_count = excluded.pitch_count
        `,
        nextRow.id,
        nextRow.coach_id,
        nextRow.event_id,
        nextRow.pitch_type,
        nextRow.pitch_count
      );
    }
  });
}

/**
 * Reads cached pitch-breakdown rows for one or more event ids.
 *
 * @param coachId - authenticated coach id
 * @param eventIds - parent event ids to hydrate
 * @returns matching cached breakdown rows
 */
export async function listCachedPitchBreakdownForEventIds(
  coachId: string,
  eventIds: string[]
) {
  if (eventIds.length === 0) {
    return [] as EventPitchBreakdown[];
  }

  const db = await getLocalDatabase();
  const placeholders = eventIds.map(() => '?').join(', ');

  return db.getAllAsync<EventPitchBreakdown>(
    `
      SELECT id, event_id, pitch_type, pitch_count
      FROM cached_event_pitch_breakdown
      WHERE coach_id = ? AND event_id IN (${placeholders})
      ORDER BY event_id ASC, pitch_type ASC
    `,
    coachId,
    ...eventIds
  );
}

/**
 * Adds a pending mutation to the sync queue.
 *
 * @param input - queue entry payload without generated timestamps/counters
 * @returns stored sync queue record
 */
export async function enqueueOfflineMutation(input: EnqueueOfflineMutationInput) {
  const db = await getLocalDatabase();
  const now = nowIsoString();
  const record: OfflineSyncQueueRecord = {
    ...input,
    attempt_count: 0,
    last_error: null,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `
      INSERT INTO sync_queue (
        id, coach_id, mutation_type, entity_type, entity_id, payload_json,
        status, attempt_count, last_error, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    record.id,
    record.coach_id,
    record.mutation_type,
    record.entity_type,
    record.entity_id,
    record.payload_json,
    record.status,
    record.attempt_count,
    record.last_error,
    record.created_at,
    record.updated_at
  );

  return record;
}

/**
 * Lists queued mutations for a coach.
 *
 * @param coachId - authenticated coach id
 * @param statuses - optional status filter
 * @returns queued mutations in oldest-first order
 */
export async function listSyncQueueEntries(
  coachId: string,
  statuses: OfflineSyncQueueStatus[] = ['pending', 'failed', 'syncing']
) {
  const db = await getLocalDatabase();
  const placeholders = statuses.map(() => '?').join(', ');

  return db.getAllAsync<OfflineSyncQueueRecord>(
    `
      SELECT *
      FROM sync_queue
      WHERE coach_id = ? AND status IN (${placeholders})
      ORDER BY created_at ASC
    `,
    coachId,
    ...statuses
  );
}

/**
 * Updates one sync queue record after an attempt.
 *
 * @param queueId - queue row id
 * @param status - next queue status
 * @param lastError - optional latest error message
 * @param attemptCount - optional explicit retry count
 */
export async function updateSyncQueueEntry(
  queueId: string,
  status: OfflineSyncQueueStatus,
  lastError: string | null = null,
  attemptCount?: number
) {
  const db = await getLocalDatabase();
  const nextUpdatedAt = nowIsoString();

  if (typeof attemptCount === 'number') {
    await db.runAsync(
      `
        UPDATE sync_queue
        SET status = ?, last_error = ?, attempt_count = ?, updated_at = ?
        WHERE id = ?
      `,
      status,
      lastError,
      attemptCount,
      nextUpdatedAt,
      queueId
    );
    return;
  }

  await db.runAsync(
    `
      UPDATE sync_queue
      SET status = ?, last_error = ?, updated_at = ?
      WHERE id = ?
    `,
    status,
    lastError,
    nextUpdatedAt,
    queueId
  );
}
