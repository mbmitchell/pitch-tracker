import {
  ArmFeel,
  BullpenFocus,
  DevelopmentPhase,
  EventType,
  Handedness,
  Intensity,
  SourceType,
} from '@/types/models';
import { isIsoDateString } from '@/utils/dates';

import type { PitcherProfileInput } from '@/services/pitchers';
import type { PitchBreakdownInput, ThrowingEventInput } from '@/services/events';

export const EVENT_TYPE_VALUES: EventType[] = [
  'bullpen',
  'game_outing',
  'live_ab',
  'flat_ground',
  'long_toss',
  'recovery_throw',
  'other',
];

export const SOURCE_TYPE_VALUES: SourceType[] = ['coach', 'pitcher', 'import', 'system'];
export const INTENSITY_VALUES: Intensity[] = ['low', 'medium', 'high', 'max'];
export const ARM_FEEL_VALUES: ArmFeel[] = ['great', 'good', 'neutral', 'sore', 'pain'];
export const DEVELOPMENT_PHASE_VALUES: DevelopmentPhase[] = [
  'assessment',
  'build',
  'preseason',
  'in_season',
  'recovery',
  'offseason',
];
export const BULLPEN_FOCUS_VALUES: BullpenFocus[] = [
  'command',
  'velocity',
  'mechanics',
  'secondary_pitches',
  'recovery',
  'live_execution',
  'other',
];
export const HANDEDNESS_VALUES: Handedness[] = ['RHP', 'LHP', 'SWITCH'];

function isEnumValue<T extends string>(value: string | null | undefined, options: readonly T[]) {
  return Boolean(value && options.includes(value as T));
}

function normalizePitchBreakdownRows(pitchBreakdown: PitchBreakdownInput[] | undefined) {
  return (pitchBreakdown ?? []).map((row) => ({
    pitch_type: row.pitch_type.trim(),
    pitch_count: row.pitch_count,
  }));
}

/**
 * Validates pitcher profile input before local persistence or remote sync.
 *
 * @param input - normalized pitcher profile values
 * @returns human-readable validation error, or null when valid
 */
export function validatePitcherProfileInput(input: PitcherProfileInput) {
  if (!input.first_name.trim()) {
    return 'First name is required.';
  }

  if (!input.last_name.trim()) {
    return 'Last name is required.';
  }

  if (input.first_name.trim().length > 50 || input.last_name.trim().length > 50) {
    return 'First and last name should stay under 50 characters.';
  }

  if (input.age !== null) {
    if (!Number.isInteger(input.age) || input.age < 5 || input.age > 30) {
      return 'Age must be a whole number between 5 and 30.';
    }
  }

  if (input.target_game_ready_date && !isIsoDateString(input.target_game_ready_date)) {
    return 'Choose a valid Target Game-Ready Date.';
  }

  if (!isEnumValue(input.handedness, HANDEDNESS_VALUES)) {
    return 'Select a valid handedness.';
  }

  if (!isEnumValue(input.development_phase, DEVELOPMENT_PHASE_VALUES)) {
    return 'Select a valid development phase.';
  }

  if (input.pitch_arsenal.some((pitch) => !pitch.trim())) {
    return 'Pitch arsenal entries cannot be blank.';
  }

  return null;
}

/**
 * Validates throwing-event input against Phase 1 workload assumptions.
 *
 * This guard lives in the shared utility layer so forms, offline writes, and
 * sync-safe service methods all apply the same business rules.
 *
 * @param input - normalized throwing-event payload
 * @returns human-readable validation error, or null when valid
 */
export function validateThrowingEventInput(input: ThrowingEventInput) {
  if (!input.pitcher_id.trim()) {
    return 'Choose a pitcher before saving the event.';
  }

  if (!input.date.trim()) {
    return 'Enter the event date.';
  }

  if (!isIsoDateString(input.date.trim())) {
    return 'Choose a valid event date.';
  }

  if (!isEnumValue(input.event_type, EVENT_TYPE_VALUES)) {
    return 'Choose a valid event type.';
  }

  if (input.total_pitches === null || !Number.isInteger(input.total_pitches) || input.total_pitches < 0) {
    return 'Total pitches must be a whole number of 0 or greater.';
  }

  if (!isEnumValue(input.intensity, INTENSITY_VALUES)) {
    return 'Choose a valid intensity level.';
  }

  if (!isEnumValue(input.arm_feel, ARM_FEEL_VALUES)) {
    return 'Choose a valid arm-feel rating.';
  }

  if (!isEnumValue(input.source_type ?? 'coach', SOURCE_TYPE_VALUES)) {
    return 'Choose a valid source type.';
  }

  if (input.event_type === 'game_outing') {
    if (
      input.innings_thrown !== null &&
      (Number.isNaN(input.innings_thrown) || input.innings_thrown < 0)
    ) {
      return 'Innings thrown must be 0 or greater when entered.';
    }
  } else if (input.innings_thrown !== null) {
    // Innings only make sense for outing-style logging. Blocking it elsewhere
    // prevents future summaries from treating non-outings like games.
    return 'Only enter innings thrown for game outings.';
  }

  if (input.event_type !== 'bullpen' && input.bullpen_focus) {
    return 'Bullpen focus should only be set for bullpen events.';
  }

  if (input.bullpen_focus && !isEnumValue(input.bullpen_focus, BULLPEN_FOCUS_VALUES)) {
    return 'Choose a valid bullpen focus.';
  }

  const normalizedBreakdown = normalizePitchBreakdownRows(input.pitch_breakdown);

  if (
    normalizedBreakdown.some(
      (row) =>
        !row.pitch_type ||
        !Number.isInteger(row.pitch_count) ||
        Number.isNaN(row.pitch_count) ||
        row.pitch_count < 0
    )
  ) {
    return 'Pitch breakdown rows need both a pitch type and a whole-number count.';
  }

  if (normalizedBreakdown.length) {
    const breakdownTotal = normalizedBreakdown.reduce(
      (sum, row) => sum + row.pitch_count,
      0
    );

    // Silent mismatches make workload history untrustworthy, so totals must
    // reconcile before the event can be saved.
    if (breakdownTotal !== input.total_pitches) {
      return `Pitch breakdown adds up to ${breakdownTotal} pitches, but total pitches is ${input.total_pitches}. Update one of them so they match.`;
    }
  }

  return null;
}
