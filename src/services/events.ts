import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  EventPitchBreakdown,
  EventPitchBreakdownInsert,
  EventType,
  PitcherProfile,
  SourceType,
  ThrowingEvent,
  ThrowingEventInsert,
} from '@/types/models';
import {
  ArmFeel,
  BullpenFocus,
  Intensity,
} from '@/types/models';
import { validateThrowingEventInput } from '@/utils/validation';

import { getPitcherByIdForCoach } from '@/services/pitchers';
import {
  generateClientId,
  getLocalPitcherByIdForCoach,
  listLocalPitchBreakdownForEventIds,
  listLocalThrowingEventsForCoach,
  listLocalThrowingEventsForPitcher,
  replaceLocalPitchBreakdownForEvent,
  upsertLocalPitchBreakdownRows,
  upsertLocalThrowingEvent,
  upsertLocalThrowingEvents,
} from '@/services/localData';
import {
  getIsOnline,
  queueLocalSyncMutation,
  refreshPendingSyncCount,
} from '@/services/sync';

export type PitchBreakdownInput = {
  pitch_type: string;
  pitch_count: number;
};

export type ThrowingEventInput = {
  pitcher_id: string;
  date: string;
  event_type: EventType;
  total_pitches: number | null;
  innings_thrown: number | null;
  intensity: Intensity;
  arm_feel: ArmFeel;
  bullpen_focus: BullpenFocus | null;
  notes: string | null;
  source_type?: SourceType;
  pitch_breakdown?: PitchBreakdownInput[];
};

export type ThrowingEventRecord = ThrowingEvent & {
  event_pitch_breakdown: EventPitchBreakdown[];
};

const supabaseClient = supabase as any;

function reportLocalCacheWriteError(context: string, error: unknown) {
  if (__DEV__) {
    console.warn(
      `[local-cache] ${context} failed`,
      error instanceof Error ? error.message : error
    );
  }
}

function canUseRemote() {
  return isSupabaseConfigured && getIsOnline();
}

function normalizePitchBreakdown(
  pitchBreakdown: PitchBreakdownInput[] | undefined
): PitchBreakdownInput[] {
  return (pitchBreakdown ?? [])
    .map((item) => ({
      pitch_type: item.pitch_type.trim(),
      pitch_count: item.pitch_count,
    }));
}

function normalizeThrowingEventInput(input: ThrowingEventInput): ThrowingEventInput {
  return {
    pitcher_id: input.pitcher_id,
    date: input.date,
    event_type: input.event_type,
    total_pitches: input.total_pitches,
    innings_thrown: input.innings_thrown,
    intensity: input.intensity,
    arm_feel: input.arm_feel,
    bullpen_focus: input.bullpen_focus,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    source_type: input.source_type ?? 'coach',
    pitch_breakdown: normalizePitchBreakdown(input.pitch_breakdown),
  };
}

async function fetchThrowingEventsForPitcherFromRemote(
  pitcherId: string,
  limit: number
) {
  const { data, error } = await supabaseClient
    .from('throwing_events')
    .select('*, event_pitch_breakdown(*)')
    .eq('pitcher_id', pitcherId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ThrowingEventRecord[]).map((event) => ({
    ...event,
    event_pitch_breakdown: event.event_pitch_breakdown ?? [],
  }));
}

async function fetchThrowingEventsForCoachFromRemote(coachId: string, limit: number) {
  const { data: pitchers, error: pitcherError } = await supabaseClient
    .from('pitcher_profiles')
    .select('id')
    .eq('created_by', coachId);

  if (pitcherError) {
    throw new Error(pitcherError.message);
  }

  const pitcherIds = ((pitchers ?? []) as Array<{ id: string }>).map((pitcher) => pitcher.id);

  if (!pitcherIds.length) {
    return [] as ThrowingEvent[];
  }

  const { data, error } = await supabaseClient
    .from('throwing_events')
    .select('*')
    .in('pitcher_id', pitcherIds)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ThrowingEvent[];
}

async function createThrowingEventInRemote(payload: ThrowingEventInsert) {
  const { data, error } = await supabaseClient
    .from('throwing_events')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ThrowingEvent;
}

async function createPitchBreakdownRowsInRemote(
  payload: EventPitchBreakdownInsert[]
) {
  if (!payload.length) {
    return [] as EventPitchBreakdown[];
  }

  const { data, error } = await supabaseClient
    .from('event_pitch_breakdown')
    .insert(payload)
    .select('*');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EventPitchBreakdown[];
}

async function hydrateLocalPitcherEvents(
  coachId: string,
  pitcherId: string,
  limit: number
) {
  const events = await listLocalThrowingEventsForPitcher(coachId, pitcherId, limit);
  const breakdownRows = await listLocalPitchBreakdownForEventIds(
    coachId,
    events.map((event) => event.id)
  );
  const breakdownByEventId = new Map<string, EventPitchBreakdown[]>();

  breakdownRows.forEach((row) => {
    const existing = breakdownByEventId.get(row.event_id) ?? [];
    existing.push(row);
    breakdownByEventId.set(row.event_id, existing);
  });

  return events.map<ThrowingEventRecord>((event) => ({
    ...event,
    event_pitch_breakdown: breakdownByEventId.get(event.id) ?? [],
  }));
}

/**
 * Reads cached throwing events across a coach account without using Supabase.
 *
 * @param coachId - authenticated coach id
 * @param limit - max number of events to return
 * @returns locally cached throwing events
 */
export async function getCachedThrowingEventsForCoach(coachId: string, limit = 200) {
  return listLocalThrowingEventsForCoach(coachId, limit);
}

/**
 * Reads cached pitcher event history with hydrated breakdown rows.
 *
 * @param coachId - authenticated coach id
 * @param pitcherId - target pitcher id
 * @param limit - max number of events to return
 * @returns locally cached event records for one pitcher
 */
export async function getCachedThrowingEventsForPitcher(
  coachId: string,
  pitcherId: string,
  limit = 10
) {
  return hydrateLocalPitcherEvents(coachId, pitcherId, limit);
}

/**
 * Writes throwing events fetched from Supabase into the local event cache.
 *
 * @param coachId - authenticated coach id
 * @param events - throwing events fetched from Supabase
 * @returns cached event collection after the upsert
 */
export async function cacheThrowingEvents(coachId: string, events: ThrowingEvent[]) {
  await upsertLocalThrowingEvents(coachId, events, 'synced');
  return listLocalThrowingEventsForCoach(coachId);
}

async function cacheThrowingEventHistory(
  coachId: string,
  pitcherId: string,
  events: ThrowingEventRecord[],
  limit: number
) {
  if (!events.length) {
    return [] as ThrowingEventRecord[];
  }

  await upsertLocalThrowingEvents(
    coachId,
    events.map((event) => ({
      id: event.id,
      pitcher_id: event.pitcher_id,
      date: event.date,
      event_type: event.event_type,
      total_pitches: event.total_pitches,
      innings_thrown: event.innings_thrown,
      intensity: event.intensity,
      arm_feel: event.arm_feel,
      bullpen_focus: event.bullpen_focus,
      notes: event.notes,
      entered_by_user_id: event.entered_by_user_id,
      source_type: event.source_type,
      created_at: event.created_at,
      updated_at: event.updated_at,
    })),
    'synced'
  );

  for (const event of events) {
    await replaceLocalPitchBreakdownForEvent(
      coachId,
      event.id,
      event.event_pitch_breakdown,
      'synced'
    );
  }

  return getCachedThrowingEventsForPitcher(coachId, pitcherId, limit);
}

async function triggerSyncIfOnline(coachId: string) {
  await refreshPendingSyncCount(coachId);
}

/**
 * Creates a throwing event for a coach-owned pitcher and queues it for sync.
 *
 * The event is written locally first so tracking can continue offline, then the
 * sync layer reconciles it with Supabase when connectivity is available.
 *
 * @param coachId - authenticated coach id
 * @param input - validated event payload from the form flow
 * @returns locally persisted event record with optional pitch breakdown rows
 */
export async function createThrowingEventForCoach(
  coachId: string,
  input: ThrowingEventInput
) {
  const pitcher =
    (await getLocalPitcherByIdForCoach(coachId, input.pitcher_id)) ??
    (await getPitcherByIdForCoach(input.pitcher_id, coachId));

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const normalizedInput = normalizeThrowingEventInput(input);
  const validationError = validateThrowingEventInput(normalizedInput);

  if (validationError) {
    throw new Error(validationError);
  }

  const now = new Date().toISOString();
  const eventId = generateClientId('event');

  const event: ThrowingEvent = {
    id: eventId,
    pitcher_id: normalizedInput.pitcher_id,
    date: normalizedInput.date,
    event_type: normalizedInput.event_type,
    total_pitches: normalizedInput.total_pitches,
    innings_thrown: normalizedInput.innings_thrown,
    intensity: normalizedInput.intensity,
    arm_feel: normalizedInput.arm_feel,
    bullpen_focus: normalizedInput.bullpen_focus,
    notes: normalizedInput.notes,
    entered_by_user_id: coachId,
    source_type: normalizedInput.source_type ?? 'coach',
    created_at: now,
    updated_at: now,
  };

  // Breakdown rows get stable client ids up front so offline-created events and
  // their child rows can be synced without a second reconciliation pass.
  const breakdownRows: EventPitchBreakdown[] = (normalizedInput.pitch_breakdown ?? []).map(
    (item) => ({
      id: generateClientId('breakdown'),
      event_id: eventId,
      pitch_type: item.pitch_type,
      pitch_count: item.pitch_count,
    })
  );

  const eventPayload: ThrowingEventInsert = { ...event };
  const breakdownPayload = breakdownRows.map<EventPitchBreakdownInsert>((row) => ({ ...row }));

  if (canUseRemote()) {
    const createdEvent = await createThrowingEventInRemote(eventPayload);
    const createdBreakdownRows = await createPitchBreakdownRowsInRemote(breakdownPayload);

    await upsertLocalThrowingEvent(coachId, createdEvent, 'synced');

    if (createdBreakdownRows.length) {
      await replaceLocalPitchBreakdownForEvent(
        coachId,
        createdEvent.id,
        createdBreakdownRows,
        'synced'
      );
    }

    await triggerSyncIfOnline(coachId);

    return {
      event: createdEvent,
      event_pitch_breakdown: createdBreakdownRows,
      pitcher,
    };
  }

  await upsertLocalThrowingEvent(coachId, event, 'pending');
  await queueLocalSyncMutation({
    id: generateClientId('queue'),
    coach_id: coachId,
    mutation_type: 'create_throwing_event',
    entity_id: event.id,
    payload_json: JSON.stringify(eventPayload),
    status: 'pending',
    created_at: now,
    updated_at: now,
  });

  if (breakdownRows.length) {
    await upsertLocalPitchBreakdownRows(coachId, breakdownRows, 'pending');

    for (const row of breakdownRows) {
      await queueLocalSyncMutation({
        id: generateClientId('queue'),
        coach_id: coachId,
        mutation_type: 'create_pitch_breakdown',
        entity_id: row.id,
        payload_json: JSON.stringify({ ...row } satisfies EventPitchBreakdownInsert),
        status: 'pending',
        created_at: now,
        updated_at: now,
      });
    }
  }

  await triggerSyncIfOnline(coachId);

  return {
    event,
    event_pitch_breakdown: breakdownRows,
    pitcher,
  };
}

/**
 * Returns a pitcher plus recent throwing history, preferring cached data first.
 *
 * When online, the function refreshes local cache from Supabase and still falls
 * back to local results if remote reads fail after some data has already been cached.
 *
 * @param coachId - authenticated coach id
 * @param pitcherId - target pitcher id
 * @param limit - max number of events to return
 * @returns pitcher profile with hydrated throwing history and breakdown rows
 */
export async function listThrowingEventsForPitcher(
  coachId: string,
  pitcherId: string,
  limit = 10
) {
  const pitcher =
    (await getLocalPitcherByIdForCoach(coachId, pitcherId)) ??
    (await getPitcherByIdForCoach(pitcherId, coachId));

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const localEvents = await getCachedThrowingEventsForPitcher(coachId, pitcherId, limit);

  if (!canUseRemote()) {
    return {
      pitcher,
      events: localEvents,
    };
  }

  try {
    const remoteEvents = await fetchThrowingEventsForPitcherFromRemote(pitcherId, limit);

    let cachedEvents: ThrowingEventRecord[];

    try {
      cachedEvents = await cacheThrowingEventHistory(coachId, pitcherId, remoteEvents, limit);
    } catch (cacheError) {
      reportLocalCacheWriteError('cacheThrowingEventHistory', cacheError);
      cachedEvents = remoteEvents;
    }

    return {
      pitcher,
      events: cachedEvents,
    };
  } catch (error) {
    return {
      pitcher,
      events: localEvents,
    };
  }
}

/**
 * Lists recent throwing events across all pitchers owned by a coach.
 *
 * This powers coach-level overviews where event detail rows are less important
 * than recency ordering and aggregate workload context.
 *
 * @param coachId - authenticated coach id
 * @param limit - max number of events to return
 * @returns throwing events in descending recency order
 */
export async function listThrowingEventsForCoach(coachId: string, limit = 200) {
  const localEvents = await getCachedThrowingEventsForCoach(coachId, limit);

  if (!canUseRemote()) {
    return localEvents;
  }

  try {
    const remoteEvents = await fetchThrowingEventsForCoachFromRemote(coachId, limit);

    try {
      await cacheThrowingEvents(coachId, remoteEvents);
      return await getCachedThrowingEventsForCoach(coachId, limit);
    } catch (cacheError) {
      reportLocalCacheWriteError('cacheThrowingEvents', cacheError);
      return remoteEvents;
    }
  } catch (error) {
    return localEvents;
  }
}

/**
 * Identifies event types that should be treated as outing-style workload.
 *
 * @param eventType - throwing event type
 * @returns true when the event should count as an outing for workload logic
 */
export function isOutingEvent(eventType: EventType) {
  return eventType === 'game_outing' || eventType === 'live_ab';
}

/**
 * Identifies bullpen events for bullpen-specific summaries and focus logic.
 *
 * @param eventType - throwing event type
 * @returns true when the event should count as a bullpen session
 */
export function isBullpenEvent(eventType: EventType) {
  return eventType === 'bullpen';
}
