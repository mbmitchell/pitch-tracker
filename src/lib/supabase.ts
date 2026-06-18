import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';

import {
  isScreenshotModeEnabled,
  screenshotModeLog,
} from '@/features/screenshot/screenshotMode';
import { Database } from '@/types/database';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

type AuthStorage = {
  getItem: (key: string) => string | Promise<string | null> | null;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const memoryStorage = new Map<string, string>();

const fallbackStorage: AuthStorage = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, value) => {
    memoryStorage.set(key, value);
  },
  removeItem: (key) => {
    memoryStorage.delete(key);
  },
};

function hasStorageShape(value: unknown): value is AuthStorage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getItem' in value &&
    typeof value.getItem === 'function' &&
    'setItem' in value &&
    typeof value.setItem === 'function' &&
    'removeItem' in value &&
    typeof value.removeItem === 'function'
  );
}

const secureStoreAuthStorage: AuthStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const webStorage =
  typeof globalThis !== 'undefined' && hasStorageShape(globalThis.localStorage)
    ? globalThis.localStorage
    : fallbackStorage;

const authStorage = Platform.OS === 'web' ? webStorage : secureStoreAuthStorage;

const screenshotModeBlockedFetch: typeof fetch = async (input, init) => {
  const requestUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : 'url' in input && typeof input.url === 'string'
          ? input.url
          : String(input);

  if (__DEV__) {
    console.log('[network-trace] blocked supabase fetch in screenshot mode', {
      init,
      stack: new Error().stack,
      url: requestUrl,
    });
  }

  throw new Error(`Blocked Supabase fetch in screenshot mode: ${requestUrl}`);
};

if (
  !process.env.EXPO_PUBLIC_SUPABASE_URL ||
  !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
) {
  console.warn(
    'Supabase env vars are missing. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to use live data.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isScreenshotModeEnabled ? fallbackStorage : authStorage,
    autoRefreshToken: !isScreenshotModeEnabled,
    persistSession: !isScreenshotModeEnabled,
    detectSessionInUrl: false,
    lock: processLock,
  },
  global: isScreenshotModeEnabled
    ? {
        fetch: screenshotModeBlockedFetch,
      }
    : undefined,
});

if (isScreenshotModeEnabled) {
  screenshotModeLog('Created local-only Supabase client with blocked fetch transport.');
}
