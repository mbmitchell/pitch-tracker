import { isRemoteAppDataEnabled } from '@/features/screenshot/screenshotMode';
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
  PlayerPitcherInviteLookupStatus,
  PitcherProfile,
  PitcherProfileInviteAcceptStatus,
  PitcherProfileInvite,
  PitcherProfileLink,
  PitcherProfileLinkInsert,
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

export type PitcherProfileLinkStatus = {
  link: PitcherProfileLink;
  linked_email: string | null;
};

export type PitcherProfileInviteMutationResult = {
  invite: PitcherProfileInvite;
  wasCreated: boolean;
  deliveryMessage: string | null;
  deliveryMode: 'email' | 'dev';
};

export type PitcherProfileInviteValidationStatus =
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'already_accepted'
  | 'pitcher_already_linked'
  | 'requires_auth'
  | 'email_mismatch'
  | 'user_already_linked'
  | 'ready_to_accept';

export type PitcherProfileInviteValidationResult = {
  status: PitcherProfileInviteValidationStatus;
  expiresAt?: string | null;
  context?: {
    invitedEmail: string | null;
    pitcherName: string | null;
  } | null;
};

export type PitcherProfileInviteAcceptResult = {
  status: PitcherProfileInviteAcceptStatus;
  inviteId?: string | null;
  linkId?: string | null;
  pitcherProfileId?: string | null;
};

export type PlayerPendingPitcherInvite = {
  id: string;
  invitedEmail: string;
  normalizedEmail: string;
  status: PlayerPitcherInviteLookupStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  pitcherProfileId: string;
  pitcherName: string | null;
};

function getInviteActionErrorMessage(error: unknown, fallback: string) {
  if (__DEV__ && error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === 'object' &&
    'context' in error &&
    error.context &&
    typeof error.context === 'object' &&
    'json' in error.context &&
    typeof error.context.json === 'function'
  ) {
    try {
      const payload = await error.context.json();

      if (payload && typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message;
      }

      if (payload && typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
    } catch (parseError) {
      if (__DEV__) {
        console.warn(
          '[pitcher-invite] unable to parse edge-function error response',
          parseError instanceof Error ? parseError.message : parseError
        );
      }
    }
  }

  return getInviteActionErrorMessage(error, fallback);
}

function reportLocalCacheWriteError(context: string, error: unknown) {
  if (__DEV__) {
    console.warn(
      `[local-cache] ${context} failed`,
      error instanceof Error ? error.message : error
    );
  }
}

function canUseRemote() {
  return isRemoteAppDataEnabled(isSupabaseConfigured) && getIsOnline();
}

function isActiveInviteStatus(status: PitcherProfileInvite['status']) {
  return status === 'pending' || status === 'sent';
}

function isInviteExpired(invite: Pick<PitcherProfileInvite, 'expires_at' | 'status'>) {
  if (invite.status === 'accepted' || invite.status === 'revoked' || invite.status === 'expired') {
    return invite.status === 'expired';
  }

  const expiresAt = new Date(invite.expires_at);

  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }

  return expiresAt.getTime() < Date.now();
}

function normalizeInviteForDisplay(invite: PitcherProfileInvite) {
  if (!isActiveInviteStatus(invite.status) || !isInviteExpired(invite)) {
    return invite;
  }

  return {
    ...invite,
    status: 'expired',
  } satisfies PitcherProfileInvite;
}

function pickRelevantInvite(invites: PitcherProfileInvite[]) {
  const normalizedInvites = invites.map(normalizeInviteForDisplay);
  const activeInvite = normalizedInvites.find((invite) => isActiveInviteStatus(invite.status));
  return activeInvite ?? normalizedInvites[0] ?? null;
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

async function fetchLinkedPitcherProfileFromRemote(userId: string) {
  const { data, error } = await supabaseClient
    .from('pitcher_profile_links')
    .select('pitcher_profiles(*)')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const pitcher = (data as { pitcher_profiles?: PitcherProfile | null } | null)?.pitcher_profiles;
  return pitcher ?? null;
}

async function fetchPitcherProfileLinkStatusFromRemote(
  coachId: string,
  pitcherProfileId: string
) {
  const pitcher = await fetchPitcherFromRemote(coachId, pitcherProfileId);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const { data, error } = await supabaseClient.rpc(
    'get_pitcher_profile_link_status_for_owned_pitcher',
    { p_pitcher_profile_id: pitcherProfileId }
  );

  if (error) {
    throw new Error(error.message);
  }

  const row = (data?.[0] ??
    null) as
    | {
        link_id: string;
        pitcher_profile_id: string;
        user_id: string;
        email: string | null;
        created_at: string;
        updated_at: string;
      }
    | null;

  if (!row) {
    return null;
  }

  return {
    link: {
      id: row.link_id,
      pitcher_profile_id: row.pitcher_profile_id,
      user_id: row.user_id,
      created_by_user_id: coachId,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    linked_email: row.email,
  } satisfies PitcherProfileLinkStatus;
}

async function findPitcherLinkTargetUserByEmail(
  coachId: string,
  pitcherProfileId: string,
  email: string
) {
  const pitcher = await fetchPitcherFromRemote(coachId, pitcherProfileId);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const { data, error } = await supabaseClient.rpc(
    'find_pitcher_link_target_for_owned_pitcher',
    {
      p_pitcher_profile_id: pitcherProfileId,
      p_email: email.trim(),
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data?.[0] ?? null) as { user_id: string; email: string | null } | null);
}

async function fetchPitcherProfileInvitesFromRemote(
  coachId: string,
  pitcherProfileId: string
) {
  const pitcher = await fetchPitcherFromRemote(coachId, pitcherProfileId);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const { data, error } = await supabaseClient
    .from('pitcher_profile_invites')
    .select('*')
    .eq('pitcher_profile_id', pitcherProfileId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PitcherProfileInvite[];
}

async function sendPitcherInviteViaServer(
  pitcherProfileId: string,
  email: string
): Promise<{
  delivery: { message: string | null; mode: 'email' | 'dev' };
  invite: PitcherProfileInvite;
  was_created: boolean;
}> {
  const { data, error } = await supabaseClient.functions.invoke(
    'send-pitcher-profile-invite',
    {
      body: {
        pitcherProfileId,
        email: email.trim(),
      },
    }
  );

  if (error) {
    throw new Error(
      getInviteActionErrorMessage(
        error,
        'Unable to create and send the pitcher invite right now.'
      )
    );
  }

  if (!data?.invite) {
    throw new Error('Invite function returned an unexpected response.');
  }

  return data as {
    delivery: { message: string | null; mode: 'email' | 'dev' };
    invite: PitcherProfileInvite;
    was_created: boolean;
  };
}

async function validatePitcherInviteViaServer(token: string) {
  const { data, error } = await supabaseClient.functions.invoke(
    'validate-pitcher-profile-invite',
    {
      body: {
        token,
      },
    }
  );

  if (error) {
    throw new Error(
      getInviteActionErrorMessage(error, 'Unable to validate this invite right now.')
    );
  }

  return data as PitcherProfileInviteValidationResult;
}

async function acceptPitcherInviteViaServer(token: string) {
  const { data, error } = await supabaseClient.functions.invoke(
    'accept-pitcher-profile-invite',
    {
      body: {
        token,
      },
    }
  );

  if (error) {
    throw new Error(
      getInviteActionErrorMessage(error, 'Unable to accept this invite right now.')
    );
  }

  return data as PitcherProfileInviteAcceptResult;
}

async function listPlayerPitcherInvitesViaServer() {
  const { data, error } = await supabaseClient.functions.invoke(
    'list-player-pitcher-invites',
    {
      body: {},
    }
  );

  if (error) {
    throw new Error(
      getInviteActionErrorMessage(error, 'Unable to check for pending invites right now.')
    );
  }

  return (data?.invites ?? []) as PlayerPendingPitcherInvite[];
}

async function acceptPlayerPitcherInviteViaServer(inviteId: string) {
  const { data, error } = await supabaseClient.functions.invoke(
    'accept-player-pitcher-invite',
    {
      body: {
        inviteId,
      },
    }
  );

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        'Unable to accept this pending invite right now.'
      )
    );
  }

  if (data?.success) {
    return {
      status: 'accepted',
      pitcherProfileId: data.pitcherProfileId ?? null,
    } satisfies PitcherProfileInviteAcceptResult;
  }

  return data as PitcherProfileInviteAcceptResult;
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
 * Links a Bullpen Planner auth user to a coach-owned pitcher profile.
 *
 * Phase 2 Step 1 keeps linking coach-driven so existing ownership rules stay
 * intact while pitcher-only access is introduced.
 *
 * @param coachId - authenticated coach performing the link
 * @param pitcherProfileId - target pitcher profile id
 * @param userId - auth.users id that should gain pitcher access
 * @returns stored link record
 */
export async function linkPitcherProfileToUser(
  coachId: string,
  pitcherProfileId: string,
  userId: string
) {
  const pitcher = await fetchPitcherFromRemote(coachId, pitcherProfileId);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const existingLink = await getPitcherProfileLinkStatusForCoach(coachId, pitcherProfileId);

  if (existingLink) {
    throw new Error('This pitcher is already linked to a player account.');
  }

  const payload: PitcherProfileLinkInsert = {
    pitcher_profile_id: pitcherProfileId,
    user_id: userId,
    created_by_user_id: coachId,
  };

  const { data, error } = await supabaseClient
    .from('pitcher_profile_links')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    if (
      error.code === '23505' &&
      error.message.includes('pitcher_profile_links_user_id_key')
    ) {
      throw new Error('This user is already linked to another pitcher.');
    }

    if (
      error.code === '23505' &&
      error.message.includes('pitcher_profile_links_pitcher_profile_id_key')
    ) {
      throw new Error('This pitcher is already linked to a player account.');
    }

    throw new Error(error.message);
  }

  return data as PitcherProfileLink;
}

/**
 * Returns the pitcher profile linked to one authenticated pitcher account.
 *
 * When a link exists, the app can route the signed-in user into the pitcher
 * shell without changing the underlying coach-owned workload model.
 *
 * @param userId - authenticated auth.users id
 * @returns linked pitcher profile when present
 */
export async function getLinkedPitcherProfileForUser(userId: string) {
  const localPitchers = await listLocalPitchersForCoach(userId);

  if (!isRemoteAppDataEnabled(isSupabaseConfigured)) {
    return localPitchers[0] ?? null;
  }

  try {
    const remotePitcher = await fetchLinkedPitcherProfileFromRemote(userId);

    if (remotePitcher) {
      try {
        await upsertLocalPitcher(userId, remotePitcher, 'synced');
      } catch (cacheError) {
        reportLocalCacheWriteError('upsertLocalPitcher', cacheError);
      }
    }

    return remotePitcher ?? localPitchers[0] ?? null;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[pitcher-link] getLinkedPitcherProfileForUser failed',
        error instanceof Error ? error.message : error
      );
    }

    return localPitchers[0] ?? null;
  }
}

/**
 * Returns the current link status for one coach-owned pitcher profile.
 *
 * @param coachId - authenticated coach id
 * @param pitcherProfileId - target pitcher profile id
 * @returns link status with linked email when present
 */
export async function getPitcherProfileLinkStatusForCoach(
  coachId: string,
  pitcherProfileId: string
) {
  if (!isRemoteAppDataEnabled(isSupabaseConfigured)) {
    return null;
  }

  try {
    return await fetchPitcherProfileLinkStatusFromRemote(coachId, pitcherProfileId);
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[pitcher-link] getPitcherProfileLinkStatusForCoach failed',
        error instanceof Error ? error.message : error
      );
    }

    return null;
  }
}

/**
 * Returns the most relevant invite status for one coach-owned pitcher profile.
 *
 * Active invites take priority over historical rows so the UI can show the current
 * pending/sent state without creating duplicate invites.
 *
 * @param coachId - authenticated coach id
 * @param pitcherProfileId - target pitcher profile id
 * @returns current invite row when one exists
 */
export async function getPitcherProfileInviteStatusForCoach(
  coachId: string,
  pitcherProfileId: string
) {
  if (!isRemoteAppDataEnabled(isSupabaseConfigured)) {
    return null;
  }

  try {
    const invites = await fetchPitcherProfileInvitesFromRemote(coachId, pitcherProfileId);
    return pickRelevantInvite(invites);
  } catch (error) {
    if (__DEV__) {
      console.warn(
        '[pitcher-invite] getPitcherProfileInviteStatusForCoach failed',
        error instanceof Error ? error.message : error
      );
    }

    return null;
  }
}

/**
 * Creates a pending invite for a coach-owned pitcher profile.
 *
 * The client delegates token generation and email delivery to the secure server
 * function so invite secrets never need to live in app state or local storage.
 *
 * @param coachId - authenticated coach id
 * @param pitcherProfileId - target pitcher profile id
 * @param email - invited player email
 * @returns invite row plus whether a new invite was created
 */
export async function createPitcherProfileInviteForCoach(
  coachId: string,
  pitcherProfileId: string,
  email: string
): Promise<PitcherProfileInviteMutationResult> {
  const pitcher = await fetchPitcherFromRemote(coachId, pitcherProfileId);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const linkedStatus = await getPitcherProfileLinkStatusForCoach(coachId, pitcherProfileId);

  if (linkedStatus) {
    throw new Error('This pitcher is already linked to a player account.');
  }

  const existingInvite = await getPitcherProfileInviteStatusForCoach(coachId, pitcherProfileId);

  if (existingInvite && isActiveInviteStatus(existingInvite.status)) {
    throw new Error(
      `An active invite already exists for ${existingInvite.email}. Use resend or revoke it first.`
    );
  }

  if (!email.trim()) {
    throw new Error('Enter the player email to create an invite.');
  }

  if (!isSupabaseConfigured) {
    throw new Error('Supabase must be configured before invites can be created.');
  }

  if (!getIsOnline()) {
    throw new Error('Invite creation needs an internet connection.');
  }

  const result = await sendPitcherInviteViaServer(pitcherProfileId, email);

  return {
    invite: result.invite,
    wasCreated: result.was_created,
    deliveryMessage: result.delivery?.message ?? null,
    deliveryMode: result.delivery?.mode ?? 'dev',
  };
}

/**
 * Resends the current active invite for a coach-owned pitcher profile.
 *
 * Resend generates a fresh token server-side, extends the expiration window,
 * and updates the sent timestamp so old links stop working.
 *
 * @param coachId - authenticated coach id
 * @param pitcherProfileId - target pitcher profile id
 * @returns refreshed invite row plus delivery metadata
 */
export async function resendPitcherProfileInviteForCoach(
  coachId: string,
  pitcherProfileId: string
): Promise<PitcherProfileInviteMutationResult> {
  const pitcher = await fetchPitcherFromRemote(coachId, pitcherProfileId);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const linkedStatus = await getPitcherProfileLinkStatusForCoach(coachId, pitcherProfileId);

  if (linkedStatus) {
    throw new Error('This pitcher is already linked to a player account.');
  }

  const existingInvite = await getPitcherProfileInviteStatusForCoach(coachId, pitcherProfileId);

  if (!existingInvite || !isActiveInviteStatus(existingInvite.status)) {
    throw new Error('There is no active invite to resend.');
  }

  if (!isSupabaseConfigured) {
    throw new Error('Supabase must be configured before invites can be resent.');
  }

  if (!getIsOnline()) {
    throw new Error('Invite resend needs an internet connection.');
  }

  const result = await sendPitcherInviteViaServer(pitcherProfileId, existingInvite.email);

  return {
    invite: result.invite,
    wasCreated: result.was_created,
    deliveryMessage: result.delivery?.message ?? null,
    deliveryMode: result.delivery?.mode ?? 'dev',
  };
}

/**
 * Revokes a pending or sent invite for a coach-owned pitcher profile.
 *
 * @param coachId - authenticated coach id
 * @param inviteId - target invite id
 * @returns updated invite row
 */
export async function revokePitcherProfileInviteForCoach(coachId: string, inviteId: string) {
  const { data: existingInvite, error: existingError } = await supabaseClient
    .from('pitcher_profile_invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const invite = (existingInvite ?? null) as PitcherProfileInvite | null;

  if (!invite) {
    throw new Error('Invite not found.');
  }

  const pitcher = await fetchPitcherFromRemote(coachId, invite.pitcher_profile_id);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  if (!isActiveInviteStatus(invite.status)) {
    return invite;
  }

  const { data, error } = await supabaseClient
    .from('pitcher_profile_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as PitcherProfileInvite;
}

/**
 * Validates one invite token through the secure server-side invite flow.
 *
 * The client never reads invite rows directly; the server returns only the
 * minimal context and state needed to continue the invite flow safely.
 *
 * @param token - opaque invite token from the email link
 * @returns safe invite validation state for UI routing
 */
export async function validatePitcherProfileInviteToken(token: string) {
  if (!isRemoteAppDataEnabled(isSupabaseConfigured)) {
    throw new Error('Supabase must be configured before invites can be validated.');
  }

  if (!token.trim()) {
    return {
      status: 'invalid',
    } satisfies PitcherProfileInviteValidationResult;
  }

  return validatePitcherInviteViaServer(token.trim());
}

/**
 * Accepts one validated pitcher invite for the signed-in player account.
 *
 * The final link creation runs server-side so the invite row update and
 * pitcher_profile_links insert succeed or fail together.
 *
 * @param token - opaque invite token from the email link
 * @returns accept result for the invite flow UI
 */
export async function acceptPitcherProfileInviteForUser(token: string) {
  if (!isRemoteAppDataEnabled(isSupabaseConfigured)) {
    throw new Error('Supabase must be configured before invites can be accepted.');
  }

  if (!token.trim()) {
    return {
      status: 'invalid',
    } satisfies PitcherProfileInviteAcceptResult;
  }

  return acceptPitcherInviteViaServer(token.trim());
}

/**
 * Lists invite rows that match the signed-in player's email.
 *
 * The client receives only safe invite context and never queries the invite
 * table directly.
 *
 * @returns invite matches for the authenticated player email
 */
export async function listPendingPitcherProfileInvitesForUser() {
  if (!isRemoteAppDataEnabled(isSupabaseConfigured)) {
    return [] as PlayerPendingPitcherInvite[];
  }

  return listPlayerPitcherInvitesViaServer();
}

/**
 * Accepts a pending invite by invite id for the signed-in player email.
 *
 * This uses the same atomic acceptance rules as the email-link flow, but it
 * starts from a secure invite lookup rather than a raw token from email.
 *
 * @param inviteId - invite row id discovered by the secure pending-invite lookup
 * @returns accept result for the onboarding prompt
 */
export async function acceptPendingPitcherProfileInviteForUser(inviteId: string) {
  if (!isRemoteAppDataEnabled(isSupabaseConfigured)) {
    throw new Error('Supabase must be configured before invites can be accepted.');
  }

  if (!inviteId.trim()) {
    return {
      status: 'invalid',
    } satisfies PitcherProfileInviteAcceptResult;
  }

  return acceptPlayerPitcherInviteViaServer(inviteId.trim());
}

/**
 * Looks up a linkable pitcher user by email for one coach-owned pitcher profile.
 *
 * @param coachId - authenticated coach id
 * @param pitcherProfileId - target pitcher profile id
 * @param email - candidate pitcher user email
 * @returns auth user id/email when found
 */
export async function findPitcherUserByEmailForCoach(
  coachId: string,
  pitcherProfileId: string,
  email: string
) {
  if (!isRemoteAppDataEnabled(isSupabaseConfigured)) {
    return null;
  }

  return findPitcherLinkTargetUserByEmail(coachId, pitcherProfileId, email);
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
