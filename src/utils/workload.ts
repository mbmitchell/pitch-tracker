import { EventType, ThrowingEvent } from '@/types/models';

import { isBullpenEvent, isOutingEvent, ThrowingEventRecord } from '@/services/events';
import { ReadinessStatus } from '@/features/dashboard/utils/staffOverview';
import { formatIsoDateForDisplay, isoDateStringToDate, isIsoDateString } from '@/utils/dates';

export type WorkloadSummary = {
  lastBullpen: ThrowingEventRecord | null;
  lastOuting: ThrowingEventRecord | null;
  lastThrowingEvent: ThrowingEventRecord | null;
  daysSinceLastThrowingEvent: number | null;
};

export type SuggestedPreseasonPhase =
  | 'foundation_throwing'
  | 'buildup_throwing'
  | 'flat_ground_to_mound_intro'
  | 'mound_progression'
  | 'game_prep'
  | 'maintenance_readiness';

export type SuggestedPreseasonPhaseContext = {
  target_date: string;
  days_until_target: number;
  weeks_until_target: number;
  suggested_phase: SuggestedPreseasonPhase;
};

function formatSnakeCaseLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Formats snake-case enum values into UI-friendly labels.
 *
 * @param value - stored enum-like value
 * @returns display-friendly label
 */
export function formatValueLabel(value: string) {
  return formatSnakeCaseLabel(value);
}

/**
 * Formats event types for coach-facing UI.
 *
 * @param eventType - stored event type
 * @returns display label used in summaries and history
 */
export function formatEventTypeLabel(eventType: EventType) {
  switch (eventType) {
    case 'game_outing':
      return 'Game outing';
    case 'live_ab':
      return 'Live AB';
    case 'flat_ground':
      return 'Flat ground';
    case 'long_toss':
      return 'Long toss';
    case 'recovery_throw':
      return 'Recovery throw';
    case 'bullpen':
      return 'Bullpen';
    default:
      return 'Other';
  }
}

/**
 * Formats event source types so coach-entered and player-entered work are easy to distinguish.
 *
 * @param sourceType - stored source type value
 * @returns display label for history and overview surfaces
 */
export function formatSourceTypeLabel(sourceType: ThrowingEvent['source_type']) {
  switch (sourceType) {
    case 'player':
      return 'Player logged';
    case 'coach':
      return 'Coach logged';
    case 'system':
      return 'System entry';
    case 'import':
      return 'Imported';
    default:
      return 'Entry';
  }
}

/**
 * Formats invite status values for coach-facing invite management UI.
 *
 * @param status - stored invite lifecycle status
 * @returns display label
 */
export function formatInviteStatusLabel(status: string) {
  return formatValueLabel(status);
}

/**
 * Formats a stored timestamp for compact coach-facing UI copy.
 *
 * @param value - ISO timestamp or date value
 * @returns formatted US date/time label
 */
export function formatTimestampLabel(value: string) {
  if (isIsoDateString(value)) {
    return formatIsoDateForDisplay(value);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

/**
 * Formats readiness status for dashboard badges and drill-down screens.
 *
 * @param readiness - derived readiness state
 * @returns human-readable readiness label
 */
export function formatReadinessLabel(readiness: ReadinessStatus) {
  switch (readiness) {
    case 'ready for bullpen':
      return 'Ready for Bullpen';
    case 'rest / caution':
      return 'Rest / Caution';
    default:
      return 'Moderate';
  }
}

/**
 * Formats bullpen focus values with a safe fallback.
 *
 * @param value - stored bullpen focus value
 * @returns display label or fallback text
 */
export function formatBullpenFocusLabel(value: string | null) {
  return value ? formatValueLabel(value) : 'Not set';
}

/**
 * Formats assigned-workout focus values derived from recommendation focus presets.
 *
 * @param value - stored assigned-workout focus value
 * @returns display label or fallback text
 */
export function formatAssignedWorkoutFocusLabel(value: string | null) {
  return value ? formatValueLabel(value) : 'Not set';
}

/**
 * Formats assigned workout statuses with explicit coach/player wording.
 *
 * @param value - stored assigned-workout status
 * @returns display label used across coach and player workout UI
 */
export function formatAssignedWorkoutStatusLabel(value: string) {
  switch (value) {
    case 'assigned':
      return 'Assigned';
    case 'viewed':
      return 'Viewed';
    case 'completed':
      return 'Completed';
    case 'skipped':
      return 'Skipped';
    case 'canceled':
      return 'Canceled';
    default:
      return formatValueLabel(value);
  }
}

/**
 * Formats development phase values for UI.
 *
 * @param value - stored development phase
 * @returns display label
 */
export function formatDevelopmentPhaseLabel(value: string) {
  return formatValueLabel(value);
}

/**
 * Formats suggested preseason build-up phases for coach-facing UI.
 *
 * @param value - derived preseason suggestion value
 * @returns display label for detail and recommendation screens
 */
export function formatSuggestedPreseasonPhaseLabel(value: SuggestedPreseasonPhase) {
  switch (value) {
    case 'buildup_throwing':
      return 'Build-up throwing';
    case 'flat_ground_to_mound_intro':
      return 'Flat-ground to mound intro';
    case 'maintenance_readiness':
      return 'Maintenance readiness';
    default:
      return formatValueLabel(value);
  }
}

/**
 * Formats intensity values for UI.
 *
 * @param value - stored intensity value
 * @returns display label
 */
export function formatIntensityLabel(value: string) {
  return formatValueLabel(value);
}

/**
 * Formats arm-feel values for UI.
 *
 * @param value - stored arm-feel value
 * @returns display label
 */
export function formatArmFeelLabel(value: string) {
  return formatValueLabel(value);
}

/**
 * Formats a stored ISO date string for display.
 *
 * @param date - YYYY-MM-DD date string
 * @returns short US-style date label
 */
export function formatDateLabel(date: string) {
  return formatIsoDateForDisplay(date);
}

/**
 * Formats pitch counts with singular/plural handling.
 *
 * @param value - pitch count value
 * @returns display-friendly pitch count label
 */
export function formatPitchCountLabel(value: number | null) {
  if (value === null || value === undefined) {
    return 'No pitch count';
  }

  return `${value} ${value === 1 ? 'pitch' : 'pitches'}`;
}

/**
 * Formats day offsets for workload summaries.
 *
 * @param value - day difference from today
 * @returns coach-facing label for recency
 */
export function formatDaysSinceLabel(value: number | null) {
  if (value === null) {
    return 'No events yet';
  }

  if (value === 0) {
    return 'Today';
  }

  if (value === 1) {
    return '1 day';
  }

  return `${value} days`;
}

/**
 * Calculates whole days between a stored event date and today.
 *
 * @param date - YYYY-MM-DD source date
 * @param today - optional override used by deterministic callers
 * @returns non-negative whole day difference
 */
export function calculateDaysSince(date: string, today = new Date()) {
  const source = isoDateStringToDate(date);
  const comparison = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const differenceMs = comparison.getTime() - source.getTime();

  return Math.max(0, Math.floor(differenceMs / (1000 * 60 * 60 * 24)));
}

/**
 * Calculates whole days until a stored target date.
 *
 * Past target dates clamp to zero so preseason suggestion logic can fall back
 * to the most immediate readiness bucket instead of producing negative values.
 *
 * @param date - YYYY-MM-DD target date
 * @param today - optional override used by deterministic callers
 * @returns non-negative whole day difference
 */
export function calculateDaysUntil(date: string, today = new Date()) {
  const target = isoDateStringToDate(date);
  const comparison = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const differenceMs = target.getTime() - comparison.getTime();

  return Math.max(0, Math.ceil(differenceMs / (1000 * 60 * 60 * 24)));
}

/**
 * Calculates rounded weeks until a target date for coach-facing timeline copy.
 *
 * @param date - YYYY-MM-DD target date
 * @param today - optional override used by deterministic callers
 * @returns rounded week difference
 */
export function calculateWeeksUntil(date: string, today = new Date()) {
  const daysUntil = calculateDaysUntil(date, today);
  return Math.round((daysUntil / 7) * 10) / 10;
}

/**
 * Derives a preseason build-up suggestion from the target game-ready timeline.
 *
 * The mapping stays intentionally simple and advisory so coaches keep control of
 * the saved development phase while still seeing a practical countdown-based cue.
 *
 * @param targetDate - optional YYYY-MM-DD target date
 * @param today - optional override used by deterministic callers
 * @returns derived preseason context or null when no target date is set
 */
export function buildSuggestedPreseasonPhaseContext(
  targetDate: string | null,
  today = new Date()
): SuggestedPreseasonPhaseContext | null {
  if (!targetDate) {
    return null;
  }

  const daysUntil = calculateDaysUntil(targetDate, today);
  const weeksUntil = calculateWeeksUntil(targetDate, today);

  let suggestedPhase: SuggestedPreseasonPhase;

  if (daysUntil >= 56) {
    suggestedPhase = 'foundation_throwing';
  } else if (daysUntil >= 42) {
    suggestedPhase = 'buildup_throwing';
  } else if (daysUntil >= 28) {
    suggestedPhase = 'flat_ground_to_mound_intro';
  } else if (daysUntil >= 14) {
    suggestedPhase = 'mound_progression';
  } else if (daysUntil >= 7) {
    suggestedPhase = 'game_prep';
  } else {
    suggestedPhase = 'maintenance_readiness';
  }

  return {
    target_date: targetDate,
    days_until_target: daysUntil,
    weeks_until_target: weeksUntil,
    suggested_phase: suggestedPhase,
  };
}

/**
 * Formats the countdown to a target game-ready date.
 *
 * @param context - derived target-date context
 * @returns compact coach-facing timeline label
 */
export function formatTargetGameReadyCountdownLabel(
  context: SuggestedPreseasonPhaseContext
) {
  if (context.days_until_target < 7) {
    if (context.days_until_target === 0) {
      return 'Target date is here';
    }

    return `${context.days_until_target} day${
      context.days_until_target === 1 ? '' : 's'
    } out`;
  }

  return `${context.weeks_until_target} week${
    context.weeks_until_target === 1 ? '' : 's'
  } out`;
}

/**
 * Builds the small workload summary shown on pitcher detail screens.
 *
 * @param events - recent events in descending recency order
 * @returns last bullpen, last outing, and last-throw recency summary
 */
export function buildWorkloadSummary(events: ThrowingEventRecord[]): WorkloadSummary {
  const lastThrowingEvent = events[0] ?? null;
  const lastBullpen = events.find((event) => isBullpenEvent(event.event_type)) ?? null;
  const lastOuting = events.find((event) => isOutingEvent(event.event_type)) ?? null;

  return {
    lastBullpen,
    lastOuting,
    lastThrowingEvent,
    daysSinceLastThrowingEvent: lastThrowingEvent
      ? calculateDaysSince(lastThrowingEvent.date)
      : null,
  };
}

/**
 * Flattens pitch-breakdown rows into a compact summary string.
 *
 * @param event - event that may include hydrated pitch breakdown rows
 * @returns summary string used in event history UI
 */
export function summarizePitchBreakdown(event: ThrowingEventRecord | ThrowingEvent) {
  if (!('event_pitch_breakdown' in event) || !event.event_pitch_breakdown.length) {
    return 'No pitch breakdown entered';
  }

  return event.event_pitch_breakdown
    .map((item) => `${item.pitch_type}: ${formatPitchCountLabel(item.pitch_count)}`)
    .join(' • ');
}
