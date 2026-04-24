import * as Crypto from 'expo-crypto';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Checks whether a string matches the UUID v4 shape used by the app's local ids.
 *
 * @param value - candidate id string
 * @returns true when the value is a valid UUID v4
 */
export function isValidUuid(value: string) {
  return UUID_V4_PATTERN.test(value);
}

/**
 * Generates an Expo-safe UUID v4 for local records and queued mutations.
 *
 * Expo and React Native do not reliably expose `crypto.randomUUID()`, so local
 * ids are centralized here on `expo-crypto` to keep offline writes portable.
 *
 * @returns validated UUID v4 string
 */
export function generateUuid() {
  const nextId = Crypto.randomUUID();

  if (!isValidUuid(nextId)) {
    throw new Error('Unable to generate a valid UUID for local record creation.');
  }

  return nextId;
}
