function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function hasValidDateParts(year: number, month: number, day: number) {
  const parsedDate = new Date(year, month - 1, day);

  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  );
}

/**
 * Checks whether a value is a real Date instance with a valid timestamp.
 *
 * @param value - candidate value from UI or parsing helpers
 * @returns true when the value is a usable Date
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function isDatePickerEventLike(
  value: unknown
): value is { nativeEvent?: { timestamp?: unknown; value?: unknown } } {
  return typeof value === 'object' && value !== null && 'nativeEvent' in value;
}

/**
 * Checks whether a string is a valid ISO calendar date.
 *
 * @param value - candidate YYYY-MM-DD string
 * @returns true when the value is a real calendar date
 */
export function isIsoDateString(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  return hasValidDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

/**
 * Converts an ISO calendar date into a local Date instance without timezone drift.
 *
 * @param value - YYYY-MM-DD date string
 * @returns local Date value for pickers and formatting
 */
export function isoDateStringToDate(value: string) {
  if (!isIsoDateString(value)) {
    return new Date(NaN);
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Normalizes the native date-picker value into a valid Date when possible.
 *
 * Some picker callbacks can surface a Date, a date string, or an empty value
 * depending on platform and library version, so the UI normalizes them here
 * before attempting ISO conversion.
 *
 * @param value - raw value returned by the picker callback
 * @returns valid Date or null when the value cannot be used safely
 */
export function normalizeDatePickerValue(value: unknown): Date | null {
  if (isValidDate(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const isoDate = isIsoDateString(value) ? value : parseUsDateStringToIso(value);

    if (!isoDate) {
      return null;
    }

    const parsedDate = isoDateStringToDate(isoDate);
    return isValidDate(parsedDate) ? parsedDate : null;
  }

  if (typeof value === 'number') {
    const parsedDate = new Date(value);
    return isValidDate(parsedDate) ? parsedDate : null;
  }

  if (isDatePickerEventLike(value)) {
    const nativeValue = value.nativeEvent?.value;

    if (nativeValue !== undefined) {
      const normalizedNativeValue = normalizeDatePickerValue(nativeValue);

      if (normalizedNativeValue) {
        return normalizedNativeValue;
      }
    }

    const timestamp = value.nativeEvent?.timestamp;

    if (typeof timestamp === 'number') {
      const parsedDate = new Date(timestamp);
      return isValidDate(parsedDate) ? parsedDate : null;
    }
  }

  return null;
}

/**
 * Converts a Date instance into a database-safe ISO calendar date.
 *
 * @param value - local Date selected in the UI
 * @returns YYYY-MM-DD string used by services and persistence
 */
export function dateToIsoDateString(value: Date) {
  if (!isValidDate(value)) {
    throw new Error('dateToIsoDateString expected a valid Date value.');
  }

  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(
    value.getDate()
  )}`;
}

/**
 * Formats an ISO date for coach-facing UI using USA formatting.
 *
 * @param value - YYYY-MM-DD date string
 * @returns MM/DD/YYYY display label
 */
export function formatIsoDateForDisplay(value: string) {
  if (!isIsoDateString(value)) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(isoDateStringToDate(value));
}

/**
 * Parses a USA-formatted date string into ISO format.
 *
 * This supports the web/manual fallback path while keeping the app's stored
 * value in ISO format everywhere else.
 *
 * @param value - MM/DD/YYYY date string
 * @returns ISO date string or null when invalid
 */
export function parseUsDateStringToIso(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (!hasValidDateParts(year, month, day)) {
    return null;
  }

  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

/**
 * Builds today's ISO date string for default form values.
 *
 * @param today - optional override for deterministic callers
 * @returns YYYY-MM-DD date string
 */
export function getTodayIsoDateString(today = new Date()) {
  return dateToIsoDateString(today);
}
