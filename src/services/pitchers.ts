import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  generateClientId,
  getLocalPitcherByIdForCoach,
  listLocalPitchersForCoach,
  upsertLocalPitcher,
  upsertLocalPitchers,
} from '@/services/localData';
import {
  getIsOnline,
  queueLocalSyncMutation,
  refreshPendingSyncCount,
} from '@/services/sync';
import {
  DevelopmentPhase,
  Handedness,
  PitcherProfile,
  PitcherProfileInsert,
  PitcherProfileUpdate,
} from '@/types/models';
import { validatePitcherProfileInput } from '@/utils/validation';

export type PitcherProfileInput = {
  first_name: string;
  last_name: string;
  age: number | null;
  grade: string | null;
  level_team: string | null;
  target_game_ready_date: string | null;
  handedness: Handedness;
  pitch_arsenal: string[];
  development_phase: DevelopmentPhase;
  primary_goals: string | null;
  notes: string | null;
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

function normalizePitcherInput(input: PitcherProfileInput): PitcherProfileInput {
  return {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    age: input.age,
    grade: input.grade?.trim() ? input.grade.trim() : null,
    level_team: input.level_team?.trim() ? input.level_team.trim() : null,
    target_game_ready_date: input.target_game_ready_date?.trim()
      ? input.target_game_ready_date.trim()
      : null,
    handedness: input.handedness,
    pitch_arsenal: Array.from(
      new Set(input.pitch_arsenal.map((pitch) => pitch.trim()).filter(Boolean))
    ),
    development_phase: input.development_phase,
    primary_goals: input.primary_goals?.trim() ? input.primary_goals.trim() : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  };
}

async function fetchPitchersFromRemote(coachId: string) {
  const { data, error } = await supabaseClient
    .from('pitcher_profiles')
    .select('*')
    .eq('created_by', coachId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PitcherProfile[];
}

async function fetchPitcherFromRemote(coachId: string, pitcherId: string) {
  const { data, error } = await supabaseClient
    .from('pitcher_profiles')
    .select('*')
    .eq('id', pitcherId)
    .eq('created_by', coachId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as PitcherProfile | null;
}

async function createPitcherInRemote(payload: PitcherProfileInsert) {
  const { data, error } = await supabaseClient
    .from('pitcher_profiles')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as PitcherProfile;
}

/**
 * Writes remote pitcher data into the local cache.
 *
 * @param coachId - authenticated coach id
 * @param pitchers - pitcher rows fetched from Supabase
 * @returns cached pitcher collection after the upsert
 */
export async function cachePitchers(coachId: string, pitchers: PitcherProfile[]) {
  await upsertLocalPitchers(coachId, pitchers, 'synced');
  return listLocalPitchersForCoach(coachId);
}

/**
 * Reads cached pitcher profiles without touching Supabase.
 *
 * @param coachId - authenticated coach id
 * @returns locally cached pitcher profiles
 */
export async function getCachedPitchers(coachId: string) {
  return listLocalPitchersForCoach(coachId);
}

/**
 * Reads one cached pitcher profile without touching Supabase.
 *
 * @param coachId - authenticated coach id
 * @param pitcherId - target pitcher id
 * @returns locally cached pitcher profile when available
 */
export async function getCachedPitcherByIdForCoach(coachId: string, pitcherId: string) {
  return getLocalPitcherByIdForCoach(coachId, pitcherId);
}

async function triggerSyncIfOnline(coachId: string) {
  await refreshPendingSyncCount(coachId);
}

/**
 * Formats a pitcher name for roster and detail views.
 *
 * @param pitcher - object containing first and last name fields
 * @returns display-friendly pitcher name
 */
export function formatPitcherName(pitcher: Pick<PitcherProfile, 'first_name' | 'last_name'>) {
  return `${pitcher.first_name} ${pitcher.last_name}`.trim();
}

/**
 * Lists all pitchers owned by a coach, preferring local cache first.
 *
 * @param coachId - authenticated coach id
 * @returns coach-owned pitchers ordered for roster display
 */
export async function listPitchersForCoach(coachId: string) {
  const localPitchers = await getCachedPitchers(coachId);

  if (!canUseRemote()) {
    return localPitchers;
  }

  try {
    const remotePitchers = await fetchPitchersFromRemote(coachId);
    try {
      return await cachePitchers(coachId, remotePitchers);
    } catch (cacheError) {
      reportLocalCacheWriteError('cachePitchers', cacheError);
      return remotePitchers;
    }
  } catch (error) {
    if (localPitchers.length) {
      return localPitchers;
    }

    throw error;
  }
}

/**
 * Loads one coach-owned pitcher profile with local fallback support.
 *
 * @param pitcherId - pitcher profile id
 * @param coachId - authenticated coach id
 * @returns pitcher profile when found, otherwise null
 */
export async function getPitcherByIdForCoach(pitcherId: string, coachId: string) {
  const localPitcher = await getCachedPitcherByIdForCoach(coachId, pitcherId);

  if (!canUseRemote()) {
    return localPitcher;
  }

  try {
    const remotePitcher = await fetchPitcherFromRemote(coachId, pitcherId);

    if (remotePitcher) {
      try {
        await upsertLocalPitcher(coachId, remotePitcher, 'synced');
      } catch (cacheError) {
        reportLocalCacheWriteError('upsertLocalPitcher', cacheError);
      }
    }

    return remotePitcher ?? localPitcher;
  } catch (error) {
    if (localPitcher) {
      return localPitcher;
    }

    throw error;
  }
}

/**
 * Creates a pitcher profile under the signed-in coach and queues it for sync.
 *
 * @param coachId - authenticated coach id
 * @param input - normalized pitcher profile input
 * @returns locally persisted pitcher profile
 */
export async function createPitcherForCoach(coachId: string, input: PitcherProfileInput) {
  const normalizedInput = normalizePitcherInput(input);
  const validationError = validatePitcherProfileInput(normalizedInput);

  if (validationError) {
    throw new Error(validationError);
  }

  const now = new Date().toISOString();

  const pitcher: PitcherProfile = {
    id: generateClientId('pitcher'),
    created_by: coachId,
    first_name: normalizedInput.first_name,
    last_name: normalizedInput.last_name,
    age: normalizedInput.age,
    grade: normalizedInput.grade,
    level_team: normalizedInput.level_team,
    target_game_ready_date: normalizedInput.target_game_ready_date,
    handedness: normalizedInput.handedness,
    pitch_arsenal: normalizedInput.pitch_arsenal,
    development_phase: normalizedInput.development_phase,
    primary_goals: normalizedInput.primary_goals,
    notes: normalizedInput.notes,
    created_at: now,
    updated_at: now,
  };

  const payload: PitcherProfileInsert = {
    ...pitcher,
    created_by: coachId,
  };

  if (canUseRemote()) {
    const createdPitcher = await createPitcherInRemote(payload);
    await upsertLocalPitcher(coachId, createdPitcher, 'synced');
    await triggerSyncIfOnline(coachId);
    return createdPitcher;
  }

  await upsertLocalPitcher(coachId, pitcher, 'pending');
  await queueLocalSyncMutation({
    id: generateClientId('queue'),
    coach_id: coachId,
    mutation_type: 'create_pitcher',
    entity_id: pitcher.id,
    payload_json: JSON.stringify(payload),
    status: 'pending',
    created_at: now,
    updated_at: now,
  });
  await triggerSyncIfOnline(coachId);

  return (await getLocalPitcherByIdForCoach(coachId, pitcher.id)) ?? pitcher;
}

/**
 * Updates a coach-owned pitcher profile and stages the change for sync.
 *
 * @param pitcherId - pitcher profile id
 * @param coachId - authenticated coach id
 * @param input - updated pitcher values
 * @returns latest locally available pitcher profile
 */
export async function updatePitcherForCoach(
  pitcherId: string,
  coachId: string,
  input: PitcherProfileInput
) {
  const existingPitcher = await getPitcherByIdForCoach(pitcherId, coachId);

  if (!existingPitcher) {
    throw new Error('Pitcher profile not found.');
  }

  const normalizedInput = normalizePitcherInput(input);
  const validationError = validatePitcherProfileInput(normalizedInput);

  if (validationError) {
    throw new Error(validationError);
  }

  const updatedPitcher: PitcherProfile = {
    ...existingPitcher,
    ...normalizedInput,
    id: pitcherId,
    created_by: coachId,
    updated_at: new Date().toISOString(),
  };

  const payload: PitcherProfileUpdate & { id: string } = {
    id: pitcherId,
    first_name: updatedPitcher.first_name,
    last_name: updatedPitcher.last_name,
    age: updatedPitcher.age,
    grade: updatedPitcher.grade,
    level_team: updatedPitcher.level_team,
    target_game_ready_date: updatedPitcher.target_game_ready_date,
    handedness: updatedPitcher.handedness,
    pitch_arsenal: updatedPitcher.pitch_arsenal,
    development_phase: updatedPitcher.development_phase,
    primary_goals: updatedPitcher.primary_goals,
    notes: updatedPitcher.notes,
    updated_at: updatedPitcher.updated_at,
  };

  await upsertLocalPitcher(coachId, updatedPitcher, 'pending');
  await queueLocalSyncMutation({
    id: generateClientId('queue'),
    coach_id: coachId,
    mutation_type: 'update_pitcher',
    entity_id: pitcherId,
    payload_json: JSON.stringify(payload),
    status: 'pending',
    created_at: updatedPitcher.updated_at,
    updated_at: updatedPitcher.updated_at,
  });
  await triggerSyncIfOnline(coachId);

  return (await getLocalPitcherByIdForCoach(coachId, pitcherId)) ?? updatedPitcher;
}
