import { EventType, ThrowingEvent } from '@/types/models';

import { isBullpenEvent, isOutingEvent, ThrowingEventRecord } from '@/services/events';

export type WorkloadSummary = {
  lastBullpen: ThrowingEventRecord | null;
  lastOuting: ThrowingEventRecord | null;
  lastThrowingEvent: ThrowingEventRecord | null;
  daysSinceLastThrowingEvent: number | null;
};

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

export function formatBullpenFocusLabel(value: string | null) {
  return value ? value.replace('_', ' ') : 'Not set';
}

export function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

export function calculateDaysSince(date: string, today = new Date()) {
  const source = new Date(`${date}T00:00:00`);
  const comparison = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const differenceMs = comparison.getTime() - source.getTime();

  return Math.max(0, Math.floor(differenceMs / (1000 * 60 * 60 * 24)));
}

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

export function summarizePitchBreakdown(event: ThrowingEventRecord | ThrowingEvent) {
  if (!('event_pitch_breakdown' in event) || !event.event_pitch_breakdown.length) {
    return 'No pitch breakdown entered';
  }

  return event.event_pitch_breakdown
    .map((item) => `${item.pitch_type}: ${item.pitch_count}`)
    .join(' • ');
}
