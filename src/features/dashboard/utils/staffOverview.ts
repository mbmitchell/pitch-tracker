import { PitcherProfile, ThrowingEvent } from '@/types/models';
import { calculateDaysSince } from '@/utils/workload';

export type ReadinessStatus = 'ready for bullpen' | 'moderate' | 'rest / caution';

export type PitcherStaffOverview = {
  pitcher: PitcherProfile;
  lastThrowingDate: ThrowingEvent['date'] | null;
  lastEventType: ThrowingEvent['event_type'] | null;
  recentPitchCount: number;
  readiness: ReadinessStatus;
};

function getRecentPitchCount(events: ThrowingEvent[]) {
  return events.reduce((sum, event) => sum + (event.total_pitches ?? 0), 0);
}

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
