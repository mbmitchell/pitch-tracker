import type { Session, User } from '@supabase/supabase-js';

export type ScreenshotProfile = 'coach' | 'player' | 'player_setup';
export type ScreenshotAccountType = 'coach' | 'player';

const truthyValues = new Set(['1', 'true', 'yes', 'on']);

function normalizeScreenshotProfile(value: string | undefined): ScreenshotProfile {
  switch (value?.trim().toLowerCase()) {
    case 'player':
      return 'player';
    case 'player_setup':
    case 'player-setup':
      return 'player_setup';
    default:
      return 'coach';
  }
}

export const isScreenshotModeEnabled = truthyValues.has(
  String(process.env.EXPO_PUBLIC_SCREENSHOT_MODE ?? '').trim().toLowerCase()
);

export const screenshotProfile = normalizeScreenshotProfile(
  process.env.EXPO_PUBLIC_SCREENSHOT_PROFILE
);

export const screenshotProfileUserIds: Record<ScreenshotProfile, string> = {
  coach: 'screenshot-coach-user',
  player: 'screenshot-player-user',
  player_setup: 'screenshot-player-setup-user',
};

export const screenshotProfileAccountTypes: Record<ScreenshotProfile, ScreenshotAccountType> = {
  coach: 'coach',
  player: 'player',
  player_setup: 'player',
};

export function buildScreenshotModeUser(profile: ScreenshotProfile): User {
  const accountType = screenshotProfileAccountTypes[profile];
  const emailPrefix = profile === 'coach' ? 'coach' : 'player';

  return {
    id: screenshotProfileUserIds[profile],
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    email: `${emailPrefix}+screenshots@getpitchready.app`,
    is_anonymous: false,
    role: 'authenticated',
    updated_at: '2026-01-01T00:00:00.000Z',
    user_metadata: {
      account_type: accountType,
      screenshot_profile: profile,
    },
  } as User;
}

export function buildScreenshotModeSession(profile: ScreenshotProfile): Session {
  const user = buildScreenshotModeUser(profile);

  return {
    access_token: `screenshot-token-${profile}`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    expires_in: 60 * 60,
    refresh_token: `screenshot-refresh-${profile}`,
    token_type: 'bearer',
    user,
  } as Session;
}

export function isRemoteAppDataEnabled(isSupabaseConfigured: boolean) {
  return isSupabaseConfigured && !isScreenshotModeEnabled;
}
