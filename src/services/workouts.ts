import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { createThrowingEventForPlayer, PitchBreakdownInput, ThrowingEventInput } from '@/services/events';
import {
  getPitcherByIdForCoach,
  getLinkedPitcherProfileForUser,
  getPitcherProfileLinkStatusForCoach,
} from '@/services/pitchers';
import {
  generateClientId,
  getLocalAssignedWorkoutById,
  listLocalAssignedWorkouts,
  replaceLocalAssignedWorkoutsForPitcher,
  upsertLocalAssignedWorkout,
  upsertLocalAssignedWorkouts,
} from '@/services/localData';
import {
  buildAssignedWorkoutPlanDetails,
  BullpenRecommendationOutput,
  RecommendationBullpenFocus,
} from '@/services/recommendations';
import { getIsOnline, queueLocalSyncMutation, refreshPendingSyncCount } from '@/services/sync';
import {
  AssignedWorkout,
  AssignedWorkoutInsert,
  AssignedWorkoutStatus,
  AssignedWorkoutUpdate,
  Intensity,
  PitcherProfile,
} from '@/types/models';
import { getTodayIsoDateString, isIsoDateString } from '@/utils/dates';

const supabaseClient = supabase as any;

export type AssignedWorkoutInput = {
  pitcher_id: string;
  planned_date: string;
  title: string;
  focus: RecommendationBullpenFocus;
  target_pitch_count: number;
  intensity: Intensity;
  pitch_mix: AssignedWorkout['pitch_mix'];
  work_blocks: AssignedWorkout['work_blocks'];
  coach_notes: string | null;
};

export type AssignedWorkoutUpdateInput = AssignedWorkoutInput;

export type AssignedWorkoutCompletionInput = {
  event_type: ThrowingEventInput['event_type'];
  date: string;
  total_pitches: number;
  innings_thrown: number | null;
  intensity: Intensity;
  arm_feel: ThrowingEventInput['arm_feel'];
  bullpen_focus: ThrowingEventInput['bullpen_focus'];
  notes: string | null;
  pitch_breakdown?: PitchBreakdownInput[];
  pitcher_feedback: string | null;
};

export type AssignedWorkoutDraft = AssignedWorkoutInput & {
  recommended_summary: BullpenRecommendationOutput;
};

export type AssignedWorkoutRecord = AssignedWorkout & {
  sync_state?: 'pending' | 'syncing' | 'failed' | 'synced';
};

function getWorkoutErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    if (__DEV__) {
      return error.message;
    }

    return fallback;
  }

  return fallback;
}

async function triggerSyncIfOnline(ownerId: string) {
  await refreshPendingSyncCount(ownerId);
}

function canUseRemote() {
  return isSupabaseConfigured && getIsOnline();
}

function normalizeAssignedWorkoutNotes(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

function validateAssignedWorkoutInput(input: AssignedWorkoutInput) {
  if (!input.pitcher_id.trim()) {
    return 'Choose a pitcher before assigning a workout.';
  }

  if (!input.title.trim()) {
    return 'Workout title is required.';
  }

  if (!isIsoDateString(input.planned_date)) {
    return 'Choose a valid planned date.';
  }

  if (!input.focus.trim()) {
    return 'Workout focus is required.';
  }

  if (!Number.isInteger(input.target_pitch_count) || input.target_pitch_count < 0) {
    return 'Target pitch count must be a whole number of 0 or greater.';
  }

  if (!['low', 'medium', 'high', 'max'].includes(input.intensity)) {
    return 'Choose a valid workout intensity.';
  }

  return null;
}

function normalizeAssignedWorkoutInput(input: AssignedWorkoutInput): AssignedWorkoutInput {
  return {
    ...input,
    title: input.title.trim(),
    focus: input.focus,
    coach_notes: normalizeAssignedWorkoutNotes(input.coach_notes),
  };
}

function sortAssignedWorkouts(workouts: AssignedWorkout[]) {
  return [...workouts].sort((a, b) => {
    const dateCompare = a.planned_date.localeCompare(b.planned_date);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return b.created_at.localeCompare(a.created_at);
  });
}

function mergeAssignedWorkoutsWithLocalUnsynced(
  remoteWorkouts: AssignedWorkout[],
  localWorkouts: AssignedWorkoutRecord[]
) {
  const remoteById = new Map(remoteWorkouts.map((workout) => [workout.id, workout]));

  for (const localWorkout of localWorkouts) {
    if (localWorkout.sync_state && localWorkout.sync_state !== 'synced') {
      remoteById.set(localWorkout.id, localWorkout);
    }
  }

  return sortAssignedWorkouts(Array.from(remoteById.values()));
}

async function fetchAssignedWorkoutById(workoutId: string) {
  const { data, error } = await supabaseClient
    .from('assigned_workouts')
    .select('*')
    .eq('id', workoutId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as AssignedWorkout | null;
}

async function fetchAssignedWorkoutsForPitcherFromRemote(pitcherId: string) {
  const { data, error } = await supabaseClient
    .from('assigned_workouts')
    .select('*')
    .eq('pitcher_id', pitcherId)
    .order('planned_date', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AssignedWorkout[];
}

async function cacheAssignedWorkouts(
  ownerId: string,
  pitcherId: string,
  workouts: AssignedWorkout[]
) {
  await replaceLocalAssignedWorkoutsForPitcher(ownerId, pitcherId, workouts, 'synced');
  return listLocalAssignedWorkouts(ownerId, pitcherId);
}

function isPlayerVisibleWorkoutStatus(status: AssignedWorkoutStatus) {
  return status !== 'canceled';
}

/**
 * Builds a coach-editable workout draft from the current recommendation output.
 *
 * @param pitcher - target pitcher profile
 * @param recommendation - deterministic recommendation output for this pitcher
 * @param plannedDate - optional planned date override
 * @returns coach-editable workout draft seeded from the recommendation
 */
export function buildAssignedWorkoutDraftFromRecommendation(
  pitcher: PitcherProfile,
  recommendation: BullpenRecommendationOutput,
  plannedDate = getTodayIsoDateString()
): AssignedWorkoutDraft {
  const focus = recommendation.input_snapshot.bullpen_focus;
  const planDetails = buildAssignedWorkoutPlanDetails(
    recommendation.recommended_total_pitch_count,
    focus,
    pitcher.pitch_arsenal
  );

  return {
    pitcher_id: pitcher.id,
    planned_date: plannedDate,
    title: `${pitcher.first_name} ${pitcher.last_name} throwing plan`,
    focus,
    target_pitch_count: recommendation.recommended_total_pitch_count,
    intensity: recommendation.recommended_intensity,
    pitch_mix: planDetails.pitch_mix,
    work_blocks: planDetails.work_blocks,
    coach_notes: recommendation.coaching_notes.join('\n'),
    recommended_summary: recommendation,
  };
}

/**
 * Lists assigned workouts for one coach-owned pitcher.
 *
 * @param coachId - authenticated coach id
 * @param pitcherId - target pitcher id
 * @returns workouts ordered by planned date
 */
export async function listAssignedWorkoutsForPitcher(coachId: string, pitcherId: string) {
  const pitcher = await getPitcherByIdForCoach(pitcherId, coachId);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const localWorkouts = await listLocalAssignedWorkouts(coachId, pitcherId);

  if (!canUseRemote()) {
    return localWorkouts;
  }

  try {
    const remoteWorkouts = await fetchAssignedWorkoutsForPitcherFromRemote(pitcherId);
    const mergedWorkouts = mergeAssignedWorkoutsWithLocalUnsynced(
      remoteWorkouts,
      localWorkouts
    );

    try {
      return await cacheAssignedWorkouts(coachId, pitcherId, mergedWorkouts);
    } catch (cacheError) {
      if (__DEV__) {
        console.warn(
          '[assigned-workouts] cacheAssignedWorkoutsForPitcher failed',
          cacheError instanceof Error ? cacheError.message : cacheError
        );
      }
      return mergedWorkouts;
    }
  } catch (error) {
    if (localWorkouts.length) {
      return localWorkouts;
    }

    throw new Error(getWorkoutErrorMessage(error, 'Unable to load assigned workouts right now.'));
  }
}

/**
 * Lists assigned workouts visible to the linked player account.
 *
 * @param userId - authenticated player user id
 * @returns assigned workouts ordered by planned date
 */
export async function listAssignedWorkoutsForPlayer(userId: string) {
  const linkedPitcher = await getLinkedPitcherProfileForUser(userId);

  if (!linkedPitcher) {
    return [] as AssignedWorkout[];
  }

  const localWorkouts = await listLocalAssignedWorkouts(userId, linkedPitcher.id);

  if (!canUseRemote()) {
    return localWorkouts.filter((workout) => workout.status !== 'canceled');
  }

  try {
    const remoteWorkouts = await fetchAssignedWorkoutsForPitcherFromRemote(linkedPitcher.id);
    const visibleRemoteWorkouts = remoteWorkouts.filter((workout) => workout.status !== 'canceled');
    const mergedWorkouts = mergeAssignedWorkoutsWithLocalUnsynced(
      visibleRemoteWorkouts,
      localWorkouts
    );

    try {
      const cached = await cacheAssignedWorkouts(userId, linkedPitcher.id, mergedWorkouts);
      return sortAssignedWorkouts(cached);
    } catch (cacheError) {
      if (__DEV__) {
        console.warn(
          '[assigned-workouts] cacheAssignedWorkoutsForPlayer failed',
          cacheError instanceof Error ? cacheError.message : cacheError
        );
      }
      return sortAssignedWorkouts(mergedWorkouts);
    }
  } catch (error) {
    if (localWorkouts.length) {
      return sortAssignedWorkouts(localWorkouts.filter((workout) => workout.status !== 'canceled'));
    }

    throw new Error(getWorkoutErrorMessage(error, 'Assigned workouts are unavailable right now.'));
  }
}

/**
 * Returns one assigned workout when it belongs to the signed-in linked player.
 *
 * @param userId - authenticated player user id
 * @param workoutId - target workout id
 * @returns workout row when it is visible to the linked player
 */
export async function getAssignedWorkoutForPlayer(userId: string, workoutId: string) {
  const linkedPitcher = await getLinkedPitcherProfileForUser(userId);

  if (!linkedPitcher) {
    throw new Error('Finish player setup before viewing assigned workouts.');
  }

  const localWorkout = await getLocalAssignedWorkoutById(userId, workoutId);

  if (localWorkout?.sync_state && localWorkout.sync_state !== 'synced') {
    return localWorkout;
  }

  if (!canUseRemote()) {
    if (
      localWorkout &&
      localWorkout.pitcher_id === linkedPitcher.id &&
      isPlayerVisibleWorkoutStatus(localWorkout.status)
    ) {
      return localWorkout;
    }

    throw new Error('Assigned workout not found for this player.');
  }

  try {
    const workout = await fetchAssignedWorkoutById(workoutId);

    if (!workout || workout.pitcher_id !== linkedPitcher.id || !isPlayerVisibleWorkoutStatus(workout.status)) {
      throw new Error('Assigned workout not found for this player.');
    }

    try {
      await upsertLocalAssignedWorkout(userId, workout, 'synced');
    } catch (cacheError) {
      if (__DEV__) {
        console.warn(
          '[assigned-workouts] upsertLocalAssignedWorkout failed',
          cacheError instanceof Error ? cacheError.message : cacheError
        );
      }
    }

    return workout;
  } catch (error) {
    if (
      localWorkout &&
      localWorkout.pitcher_id === linkedPitcher.id &&
      isPlayerVisibleWorkoutStatus(localWorkout.status)
    ) {
      return localWorkout;
    }

    throw error;
  }
}

/**
 * Returns one assigned workout when it belongs to a coach-owned pitcher.
 *
 * @param coachId - authenticated coach id
 * @param workoutId - target workout id
 * @returns workout row when it belongs to one of the coach's pitchers
 */
export async function getAssignedWorkoutForCoach(coachId: string, workoutId: string) {
  const workout = await fetchAssignedWorkoutById(workoutId);

  if (!workout) {
    throw new Error('Assigned workout not found.');
  }

  const pitcher = await getPitcherByIdForCoach(workout.pitcher_id, coachId);

  if (!pitcher) {
    throw new Error('Assigned workout is not available for this coach.');
  }

  return workout;
}

/**
 * Creates an assigned workout for a coach-owned pitcher.
 *
 * @param coachId - authenticated coach id
 * @param input - normalized workout draft
 * @returns created workout row
 */
export async function createAssignedWorkoutForCoach(
  coachId: string,
  input: AssignedWorkoutInput
) {
  const pitcher = await getPitcherByIdForCoach(input.pitcher_id, coachId);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  if (!canUseRemote()) {
    throw new Error('Assigning workouts needs an internet connection right now.');
  }

  const normalizedInput = normalizeAssignedWorkoutInput(input);
  const validationError = validateAssignedWorkoutInput(normalizedInput);

  if (validationError) {
    throw new Error(validationError);
  }

  const linkedStatus = await getPitcherProfileLinkStatusForCoach(
    coachId,
    normalizedInput.pitcher_id
  );

  if (!linkedStatus) {
    throw new Error('Link a player account before assigning workouts to this pitcher.');
  }

  const payload: AssignedWorkoutInsert = {
    assigned_by_user_id: coachId,
    coach_notes: normalizedInput.coach_notes,
    focus: normalizedInput.focus,
    intensity: normalizedInput.intensity,
    pitch_mix: normalizedInput.pitch_mix,
    pitcher_id: normalizedInput.pitcher_id,
    planned_date: normalizedInput.planned_date,
    status: 'assigned',
    target_pitch_count: normalizedInput.target_pitch_count,
    title: normalizedInput.title,
    work_blocks: normalizedInput.work_blocks,
  };

  try {
    const { data, error } = await supabaseClient
      .from('assigned_workouts')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    await upsertLocalAssignedWorkout(coachId, data as AssignedWorkout, 'synced');
    await triggerSyncIfOnline(coachId);

    return data as AssignedWorkout;
  } catch (error) {
    throw new Error(
      getWorkoutErrorMessage(error, 'Unable to assign the workout right now.')
    );
  }
}

/**
 * Updates a coach-owned assigned workout.
 *
 * @param coachId - authenticated coach id
 * @param workoutId - target workout id
 * @param input - replacement workout fields
 * @returns updated workout row
 */
export async function updateAssignedWorkoutForCoach(
  coachId: string,
  workoutId: string,
  input: AssignedWorkoutUpdateInput
) {
  await getAssignedWorkoutForCoach(coachId, workoutId);

  if (!canUseRemote()) {
    throw new Error('Updating workouts needs an internet connection right now.');
  }

  const normalizedInput = normalizeAssignedWorkoutInput(input);
  const validationError = validateAssignedWorkoutInput(normalizedInput);

  if (validationError) {
    throw new Error(validationError);
  }

  const payload: AssignedWorkoutUpdate = {
    coach_notes: normalizedInput.coach_notes,
    focus: normalizedInput.focus,
    intensity: normalizedInput.intensity,
    pitch_mix: normalizedInput.pitch_mix,
    planned_date: normalizedInput.planned_date,
    target_pitch_count: normalizedInput.target_pitch_count,
    title: normalizedInput.title,
    work_blocks: normalizedInput.work_blocks,
  };

  try {
    const { data, error } = await supabaseClient
      .from('assigned_workouts')
      .update(payload)
      .eq('id', workoutId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    await upsertLocalAssignedWorkout(coachId, data as AssignedWorkout, 'synced');
    await triggerSyncIfOnline(coachId);

    return data as AssignedWorkout;
  } catch (error) {
    throw new Error(
      getWorkoutErrorMessage(error, 'Unable to update the workout right now.')
    );
  }
}

/**
 * Cancels a coach-owned assigned workout.
 *
 * @param coachId - authenticated coach id
 * @param workoutId - target workout id
 * @returns updated workout row
 */
export async function cancelAssignedWorkoutForCoach(coachId: string, workoutId: string) {
  await getAssignedWorkoutForCoach(coachId, workoutId);

  if (!canUseRemote()) {
    throw new Error('Canceling workouts needs an internet connection right now.');
  }

  try {
    const { data, error } = await supabaseClient
      .from('assigned_workouts')
      .update({ status: 'canceled' satisfies AssignedWorkoutStatus })
      .eq('id', workoutId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    await upsertLocalAssignedWorkout(coachId, data as AssignedWorkout, 'synced');
    await triggerSyncIfOnline(coachId);

    return data as AssignedWorkout;
  } catch (error) {
    throw new Error(
      getWorkoutErrorMessage(error, 'Unable to cancel the workout right now.')
    );
  }
}

/**
 * Marks player-visible workouts as viewed.
 *
 * @param userId - authenticated player user id
 * @param workoutIds - workouts currently being shown to the player
 * @returns updated workout rows
 */
export async function markAssignedWorkoutsViewedForPlayer(
  userId: string,
  workoutIds: string[]
) {
  const linkedPitcher = await getLinkedPitcherProfileForUser(userId);

  if (!linkedPitcher || !workoutIds.length || !canUseRemote()) {
    return [] as AssignedWorkout[];
  }

  const now = new Date().toISOString();
  try {
    const { data, error } = await supabaseClient
      .from('assigned_workouts')
      .update({
        status: 'viewed',
        viewed_at: now,
      } satisfies AssignedWorkoutUpdate)
      .eq('pitcher_id', linkedPitcher.id)
      .eq('status', 'assigned')
      .in('id', workoutIds)
      .select('*');

    if (error) {
      throw error;
    }

    const workouts = (data ?? []) as AssignedWorkout[];
    await upsertLocalAssignedWorkouts(userId, workouts, 'synced');
    await triggerSyncIfOnline(userId);

    return workouts;
  } catch (error) {
    throw new Error(
      getWorkoutErrorMessage(error, 'Unable to update workout status right now.')
    );
  }
}

/**
 * Completes one assigned workout by creating the linked throwing event and then
 * marking the workout complete.
 *
 * @param userId - authenticated player user id
 * @param workoutId - target workout id
 * @param input - completion payload and optional player feedback
 * @returns updated workout plus the created throwing event id
 */
export async function completeAssignedWorkoutForPlayer(
  userId: string,
  workoutId: string,
  input: AssignedWorkoutCompletionInput
) {
  const linkedPitcher = await getLinkedPitcherProfileForUser(userId);

  if (!linkedPitcher) {
    throw new Error('Finish player setup before completing assigned workouts.');
  }

  const workout = await getAssignedWorkoutForPlayer(userId, workoutId);

  if (workout.status === 'completed') {
    throw new Error('This workout has already been completed.');
  }

  if (workout.status === 'canceled') {
    throw new Error('This workout was canceled and cannot be completed.');
  }

  const eventResult = await createThrowingEventForPlayer(userId, {
    pitcher_id: linkedPitcher.id,
    date: input.date,
    event_type: input.event_type,
    total_pitches: input.total_pitches,
    innings_thrown: input.innings_thrown,
    intensity: input.intensity,
    arm_feel: input.arm_feel,
    bullpen_focus: input.bullpen_focus,
    notes: input.notes,
    pitch_breakdown: input.pitch_breakdown,
    source_type: 'player',
  });

  const now = new Date().toISOString();
  const completedWorkout: AssignedWorkout = {
    ...workout,
    status: 'completed',
    completed_at: now,
    completed_throwing_event_id: eventResult.event.id,
    pitcher_feedback: normalizeAssignedWorkoutNotes(input.pitcher_feedback),
    viewed_at: workout.viewed_at ?? now,
    updated_at: now,
  };

  if (!canUseRemote()) {
    await upsertLocalAssignedWorkout(userId, completedWorkout, 'pending');
    await queueLocalSyncMutation({
      id: generateClientId('queue'),
      coach_id: userId,
      mutation_type: 'update_assigned_workout',
      entity_id: completedWorkout.id,
      payload_json: JSON.stringify({
        id: completedWorkout.id,
        status: completedWorkout.status,
        viewed_at: completedWorkout.viewed_at,
        completed_at: completedWorkout.completed_at,
        pitcher_feedback: completedWorkout.pitcher_feedback,
        completed_throwing_event_id: completedWorkout.completed_throwing_event_id,
        updated_at: completedWorkout.updated_at,
      } satisfies AssignedWorkoutUpdate & { id: string }),
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
    await triggerSyncIfOnline(userId);

    return {
      event: eventResult.event,
      workout: completedWorkout,
    };
  }

  try {
    const { data, error } = await supabaseClient
      .from('assigned_workouts')
      .update({
        completed_at: completedWorkout.completed_at,
        completed_throwing_event_id: completedWorkout.completed_throwing_event_id,
        pitcher_feedback: completedWorkout.pitcher_feedback,
        status: completedWorkout.status,
        viewed_at: completedWorkout.viewed_at,
      } satisfies AssignedWorkoutUpdate)
      .eq('id', workoutId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    await upsertLocalAssignedWorkout(userId, data as AssignedWorkout, 'synced');
    await triggerSyncIfOnline(userId);

    return {
      event: eventResult.event,
      workout: data as AssignedWorkout,
    };
  } catch (error) {
    throw new Error(
      getWorkoutErrorMessage(
        error,
        'Your throwing event was saved, but the assigned workout could not be marked complete. Please refresh and try again.'
      )
    );
  }
}
