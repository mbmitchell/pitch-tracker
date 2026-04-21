import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  ArmFeel,
  BullpenFocus,
  EventPitchBreakdown,
  EventPitchBreakdownInsert,
  EventType,
  Intensity,
  PitcherProfile,
  SourceType,
  ThrowingEvent,
  ThrowingEventInsert,
} from '@/types/models';

import { getPitcherByIdForCoach } from '@/services/pitchers';

export type PitchBreakdownInput = {
  pitch_type: string;
  pitch_count: number;
};

export type ThrowingEventInput = {
  pitcher_id: string;
  date: string;
  event_type: EventType;
  total_pitches: number | null;
  innings_thrown: number | null;
  intensity: Intensity;
  arm_feel: ArmFeel;
  bullpen_focus: BullpenFocus | null;
  notes: string | null;
  source_type?: SourceType;
  pitch_breakdown?: PitchBreakdownInput[];
};

export type ThrowingEventRecord = ThrowingEvent & {
  event_pitch_breakdown: EventPitchBreakdown[];
};

const supabaseClient = supabase as any;

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to continue.'
    );
  }
}

function normalizePitchBreakdown(
  pitchBreakdown: PitchBreakdownInput[] | undefined
): PitchBreakdownInput[] {
  return (pitchBreakdown ?? [])
    .map((item) => ({
      pitch_type: item.pitch_type.trim(),
      pitch_count: item.pitch_count,
    }))
    .filter((item) => item.pitch_type && item.pitch_count >= 0);
}

function normalizeThrowingEventInput(input: ThrowingEventInput): ThrowingEventInput {
  return {
    pitcher_id: input.pitcher_id,
    date: input.date,
    event_type: input.event_type,
    total_pitches: input.total_pitches,
    innings_thrown: input.innings_thrown,
    intensity: input.intensity,
    arm_feel: input.arm_feel,
    bullpen_focus: input.bullpen_focus,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    source_type: input.source_type ?? 'coach',
    pitch_breakdown: normalizePitchBreakdown(input.pitch_breakdown),
  };
}

export async function createThrowingEventForCoach(
  coachId: string,
  input: ThrowingEventInput
) {
  assertSupabaseConfigured();

  const pitcher = await getPitcherByIdForCoach(input.pitcher_id, coachId);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const normalizedInput = normalizeThrowingEventInput(input);

  const eventPayload: ThrowingEventInsert = {
    pitcher_id: normalizedInput.pitcher_id,
    date: normalizedInput.date,
    event_type: normalizedInput.event_type,
    total_pitches: normalizedInput.total_pitches,
    innings_thrown: normalizedInput.innings_thrown,
    intensity: normalizedInput.intensity,
    arm_feel: normalizedInput.arm_feel,
    bullpen_focus: normalizedInput.bullpen_focus,
    notes: normalizedInput.notes,
    entered_by_user_id: coachId,
    source_type: normalizedInput.source_type ?? 'coach',
  };

  const { data: event, error: eventError } = await supabaseClient
    .from('throwing_events')
    .insert(eventPayload)
    .select('*')
    .single();

  if (eventError) {
    throw new Error(eventError.message);
  }

  const pitchBreakdown = normalizedInput.pitch_breakdown ?? [];

  if (!pitchBreakdown.length) {
    return {
      event: event as ThrowingEvent,
      event_pitch_breakdown: [] as EventPitchBreakdown[],
      pitcher,
    };
  }

  const breakdownPayload: EventPitchBreakdownInsert[] = pitchBreakdown.map((item) => ({
    event_id: (event as ThrowingEvent).id,
    pitch_type: item.pitch_type,
    pitch_count: item.pitch_count,
  }));

  const { data: breakdown, error: breakdownError } = await supabaseClient
    .from('event_pitch_breakdown')
    .insert(breakdownPayload)
    .select('*');

  if (breakdownError) {
    await supabaseClient.from('throwing_events').delete().eq('id', (event as ThrowingEvent).id);
    throw new Error(breakdownError.message);
  }

  return {
    event: event as ThrowingEvent,
    event_pitch_breakdown: (breakdown ?? []) as EventPitchBreakdown[],
    pitcher,
  };
}

export async function listThrowingEventsForPitcher(
  coachId: string,
  pitcherId: string,
  limit = 10
) {
  assertSupabaseConfigured();

  const pitcher = await getPitcherByIdForCoach(pitcherId, coachId);

  if (!pitcher) {
    throw new Error('Pitcher profile not found for this coach.');
  }

  const { data, error } = await supabaseClient
    .from('throwing_events')
    .select('*, event_pitch_breakdown(*)')
    .eq('pitcher_id', pitcherId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return {
    pitcher,
    events: ((data ?? []) as ThrowingEventRecord[]).map((event) => ({
      ...event,
      event_pitch_breakdown: event.event_pitch_breakdown ?? [],
    })),
  };
}

export async function listThrowingEventsForCoach(
  coachId: string,
  limit = 200
) {
  assertSupabaseConfigured();

  const { data: pitchers, error: pitcherError } = await supabaseClient
    .from('pitcher_profiles')
    .select('id')
    .eq('created_by', coachId);

  if (pitcherError) {
    throw new Error(pitcherError.message);
  }

  const pitcherIds = ((pitchers ?? []) as Array<{ id: string }>).map(
    (pitcher) => pitcher.id
  );

  if (!pitcherIds.length) {
    return [] as ThrowingEvent[];
  }

  const { data, error } = await supabaseClient
    .from('throwing_events')
    .select('*')
    .in('pitcher_id', pitcherIds)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ThrowingEvent[];
}

export function isOutingEvent(eventType: EventType) {
  return eventType === 'game_outing' || eventType === 'live_ab';
}

export function isBullpenEvent(eventType: EventType) {
  return eventType === 'bullpen';
}
