import { PitcherProfile, ThrowingEvent } from '@/types/models';
import { calculateDaysSince } from '@/utils/workload';

export type ReadinessStatus = 'ready for bullpen' | 'moderate' | 'rest / caution';
export type ReadinessFilterKey = 'ready' | 'moderate' | 'caution';

export type PitcherStaffOverview = {
  pitcher: PitcherProfile;
  lastThrowingDate: ThrowingEvent['date'] | null;
  lastEventType: ThrowingEvent['event_type'] | null;
  recentPitchCount: number;
  readiness: ReadinessStatus;
};

/**
 * UI copy for readiness drill-down routes and dashboard cards.
 */
export const READINESS_FILTER_CONFIG: Record<
  ReadinessFilterKey,
  {
    status: ReadinessStatus;
    cardLabel: string;
    screenTitle: string;
    emptyTitle: string;
    subtitle: string;
  }
> = {
  ready: {
    status: 'ready for bullpen',
    cardLabel: 'Ready for Bullpen',
    screenTitle: 'Ready for Bullpen',
    emptyTitle: 'No pitchers ready for bullpen',
    subtitle: 'Pitchers whose recent workload suggests a clean bullpen day.',
  },
  moderate: {
    status: 'moderate',
    cardLabel: 'Moderate',
    screenTitle: 'Moderate',
    emptyTitle: 'No pitchers in the moderate group',
    subtitle: 'Pitchers who may be available, but should stay measured today.',
  },
  caution: {
    status: 'rest / caution',
    cardLabel: 'Rest / Caution',
    screenTitle: 'Rest / Caution',
    emptyTitle: 'No pitchers flagged for caution',
    subtitle: 'Pitchers whose recent work or arm feel calls for extra caution.',
  },
};

/**
 * Normalizes readiness filter params coming from navigation.
 *
 * @param value - route param value
 * @returns safe readiness filter key
 */
export function normalizeReadinessFilterKey(
  value: string | string[] | undefined
): ReadinessFilterKey {
  const normalized = Array.isArray(value) ? value[0] : value;

  switch (normalized) {
    case 'moderate':
      return 'moderate';
    case 'caution':
      return 'caution';
    default:
      return 'ready';
  }
}

/**
 * Filters a staff overview collection down to one readiness bucket.
 *
 * @param overview - full staff overview collection
 * @param filterKey - target readiness bucket
 * @returns overview rows matching the requested readiness state
 */
export function filterPitcherStaffOverviewByReadiness(
  overview: PitcherStaffOverview[],
  filterKey: ReadinessFilterKey
) {
  const targetStatus = READINESS_FILTER_CONFIG[filterKey].status;
  return overview.filter((item) => item.readiness === targetStatus);
}

function getRecentPitchCount(events: ThrowingEvent[]) {
  return events.reduce((sum, event) => sum + (event.total_pitches ?? 0), 0);
}

/**
 * Derives a lightweight coach-facing readiness label from recent event history.
 *
 * The rules stay intentionally simple in Phase 1 so coaches can understand why
 * a pitcher landed in a bucket without decoding a hidden model.
 *
 * @param events - recent events in descending recency order
 * @returns readiness status used by dashboard and filtered drill-down views
 */
export function deriveReadinessStatus(events: ThrowingEvent[]): ReadinessStatus {
  const lastEvent = events[0];

  if (!lastEvent) {
    return 'ready for bullpen';
  }

  const daysSinceLastEvent = calculateDaysSince(lastEvent.date);
  const recentPitchCount = getRecentPitchCount(events.slice(0, 3));
  const cautionArmFeel = lastEvent.arm_feel === 'sore' || lastEvent.arm_feel === 'pain';
  const heavyEvent =
    lastEvent.event_type === 'game_outing' ||
    lastEvent.intensity === 'max' ||
    (lastEvent.total_pitches ?? 0) >= 45;

  // These caution checks intentionally favor false positives over false
  // negatives because the dashboard is meant to start a coaching conversation,
  // not green-light aggressive work by default.
  if (cautionArmFeel || (daysSinceLastEvent <= 1 && heavyEvent) || recentPitchCount >= 90) {
    return 'rest / caution';
  }

  if (
    daysSinceLastEvent <= 2 ||
    lastEvent.intensity === 'high' ||
    lastEvent.arm_feel === 'neutral' ||
    recentPitchCount >= 45
  ) {
    return 'moderate';
  }

  return 'ready for bullpen';
}

/**
 * Joins roster data with recent throwing history for dashboard-style views.
 *
 * @param pitchers - coach-owned pitcher profiles
 * @param events - recent throwing events across the staff
 * @returns per-pitcher overview rows with readiness and recency context
 */
export function buildPitcherStaffOverview(
  pitchers: PitcherProfile[],
  events: ThrowingEvent[]
) {
  const eventsByPitcher = new Map<string, ThrowingEvent[]>();

  events.forEach((event) => {
    const existing = eventsByPitcher.get(event.pitcher_id) ?? [];
    existing.push(event);
    eventsByPitcher.set(event.pitcher_id, existing);
  });

  return pitchers.map<PitcherStaffOverview>((pitcher) => {
    const pitcherEvents = eventsByPitcher.get(pitcher.id) ?? [];
    const lastEvent = pitcherEvents[0] ?? null;

    return {
      pitcher,
      lastThrowingDate: lastEvent?.date ?? null,
      lastEventType: lastEvent?.event_type ?? null,
      recentPitchCount: getRecentPitchCount(pitcherEvents.slice(0, 3)),
      readiness: deriveReadinessStatus(pitcherEvents),
    };
  });
}
