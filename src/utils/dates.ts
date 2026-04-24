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
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Converts a Date instance into a database-safe ISO calendar date.
 *
 * @param value - local Date selected in the UI
 * @returns YYYY-MM-DD string used by services and persistence
 */
export function dateToIsoDateString(value: Date) {
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
