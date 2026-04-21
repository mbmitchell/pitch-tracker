import { ThrowingEventRecord, isOutingEvent } from '@/services/events';
import { calculateDaysSince } from '@/utils/workload';
import {
  ArmFeel,
  BullpenFocus,
  EventType,
  Intensity,
  PitcherProfile,
} from '@/types/models';

export type RecommendationPhase =
  | 'early_preseason'
  | 'late_preseason'
  | 'early_season'
  | 'mid_season'
  | 'rebuild'
  | 'recovery';

export type RecommendationBullpenFocus =
  | 'fastball_command'
  | 'changeup_feel'
  | 'breaking_ball_feel'
  | 'sequence_work'
  | 'recovery_touch_and_feel'
  | 'outing_prep';

export type RecommendationIntensity = Extract<Intensity, 'low' | 'medium' | 'high'>;

export type BullpenRecommendationInput = {
  development_phase: RecommendationPhase;
  days_since_last_throwing_event: number | null;
  days_since_last_high_intensity_event: number | null;
  recent_total_workload: number;
  last_outing_type: EventType | null;
  bullpen_focus: RecommendationBullpenFocus;
  arm_feel: ArmFeel;
  recent_comparable_workload: number | null;
  pitch_arsenal: string[];
};

export type BullpenRecommendationPitchMixItem = {
  pitch_type: string;
  target_pitches: number;
  share_percent: number;
  intent: string;
};

export type BullpenRecommendationWorkBlock = {
  label: string;
  target_pitches: number;
  intent: string;
};

export type BullpenRecommendationOutput = {
  input_snapshot: BullpenRecommendationInput;
  recommended_total_pitch_count: number;
  recommended_intensity: RecommendationIntensity;
  recommended_pitch_mix: BullpenRecommendationPitchMixItem[];
  recommended_work_blocks: BullpenRecommendationWorkBlock[];
  coaching_notes: string[];
  caution_notes: string[];
  applied_rules: string[];
};

type PhasePreset = {
  pitch_count: number;
  intensity: RecommendationIntensity;
};

// These thresholds are intentionally plain constants so the staff can tune them
// without wading through intertwined conditionals.
const PHASE_PRESETS: Record<RecommendationPhase, PhasePreset> = {
  early_preseason: { pitch_count: 24, intensity: 'low' },
  late_preseason: { pitch_count: 32, intensity: 'medium' },
  early_season: { pitch_count: 28, intensity: 'medium' },
  mid_season: { pitch_count: 36, intensity: 'high' },
  rebuild: { pitch_count: 20, intensity: 'low' },
  recovery: { pitch_count: 12, intensity: 'low' },
};

const RECENT_WORKLOAD_EVENT_WINDOW = 3;
const MAX_COMPARABLE_JUMP = 8;
const MIN_RECOMMENDED_PITCHES = 8;
const MAX_RECOMMENDED_PITCHES = 40;

function clampPitchCount(value: number) {
  return Math.max(MIN_RECOMMENDED_PITCHES, Math.min(MAX_RECOMMENDED_PITCHES, value));
}

function intensityRank(value: RecommendationIntensity) {
  switch (value) {
    case 'low':
      return 0;
    case 'medium':
      return 1;
    default:
      return 2;
  }
}

function lowerIntensity(
  current: RecommendationIntensity,
  cap: RecommendationIntensity
): RecommendationIntensity {
  return intensityRank(current) > intensityRank(cap) ? cap : current;
}

function sumRecentWorkload(events: ThrowingEventRecord[]) {
  return events
    .slice(0, RECENT_WORKLOAD_EVENT_WINDOW)
    .reduce((sum, event) => sum + (event.total_pitches ?? 0), 0);
}

function getMostRecentOutingType(events: ThrowingEventRecord[]) {
  const outing = events.find((event) => isOutingEvent(event.event_type));
  return outing?.event_type ?? null;
}

function getDaysSinceLastHighIntensityEvent(events: ThrowingEventRecord[]) {
  const highIntensityEvent = events.find(
    (event) =>
      event.intensity === 'high' ||
      event.intensity === 'max' ||
      event.event_type === 'game_outing'
  );

  return highIntensityEvent ? calculateDaysSince(highIntensityEvent.date) : null;
}

function getComparableWorkload(events: ThrowingEventRecord[]) {
  const comparable = events.find((event) => event.total_pitches !== null);
  return comparable?.total_pitches ?? null;
}

function inferRecommendationPhase(
  pitcher: PitcherProfile,
  recentTotalWorkload: number,
  daysSinceLastThrowingEvent: number | null
): RecommendationPhase {
  switch (pitcher.development_phase) {
    case 'recovery':
      return 'recovery';
    case 'build':
    case 'assessment':
      return 'rebuild';
    case 'preseason':
      return recentTotalWorkload >= 40 ? 'late_preseason' : 'early_preseason';
    case 'in_season':
      return recentTotalWorkload >= 55 || (daysSinceLastThrowingEvent ?? 99) <= 3
        ? 'mid_season'
        : 'early_season';
    default:
      return 'early_preseason';
  }
}

function inferBullpenFocusFromGoalText(goals: string | null) {
  const normalized = goals?.toLowerCase() ?? '';

  if (normalized.includes('changeup')) {
    return 'changeup_feel' as const;
  }

  if (
    normalized.includes('slider') ||
    normalized.includes('curve') ||
    normalized.includes('breaking')
  ) {
    return 'breaking_ball_feel' as const;
  }

  if (
    normalized.includes('sequence') ||
    normalized.includes('execute') ||
    normalized.includes('hitter')
  ) {
    return 'sequence_work' as const;
  }

  if (normalized.includes('recovery') || normalized.includes('touch and feel')) {
    return 'recovery_touch_and_feel' as const;
  }

  if (normalized.includes('outing') || normalized.includes('prep')) {
    return 'outing_prep' as const;
  }

  return 'fastball_command' as const;
}

function mapBullpenFocus(
  bullpenFocus: BullpenFocus | null,
  goals: string | null,
  lastOutingType: EventType | null,
  recommendationPhase: RecommendationPhase
): RecommendationBullpenFocus {
  if (recommendationPhase === 'recovery') {
    return 'recovery_touch_and_feel';
  }

  switch (bullpenFocus) {
    case 'command':
      return 'fastball_command';
    case 'secondary_pitches':
      return inferBullpenFocusFromGoalText(goals);
    case 'live_execution':
      return 'sequence_work';
    case 'recovery':
      return 'recovery_touch_and_feel';
    case 'velocity':
    case 'mechanics':
      return lastOutingType === 'game_outing' ? 'outing_prep' : 'fastball_command';
    default:
      return inferBullpenFocusFromGoalText(goals);
  }
}

function getMostRecentBullpenFocus(events: ThrowingEventRecord[]) {
  const latestBullpen = events.find(
    (event) => event.event_type === 'bullpen' && event.bullpen_focus
  );
  return latestBullpen?.bullpen_focus ?? null;
}

export function buildBullpenRecommendationInput(
  pitcher: PitcherProfile,
  events: ThrowingEventRecord[]
): BullpenRecommendationInput {
  const daysSinceLastThrowingEvent = events[0]
    ? calculateDaysSince(events[0].date)
    : null;
  const recentTotalWorkload = sumRecentWorkload(events);
  const lastOutingType = getMostRecentOutingType(events);
  const recommendationPhase = inferRecommendationPhase(
    pitcher,
    recentTotalWorkload,
    daysSinceLastThrowingEvent
  );

  return {
    development_phase: recommendationPhase,
    days_since_last_throwing_event: daysSinceLastThrowingEvent,
    days_since_last_high_intensity_event: getDaysSinceLastHighIntensityEvent(events),
    recent_total_workload: recentTotalWorkload,
    last_outing_type: lastOutingType,
    bullpen_focus: mapBullpenFocus(
      getMostRecentBullpenFocus(events),
      pitcher.primary_goals,
      lastOutingType,
      recommendationPhase
    ),
    arm_feel: events[0]?.arm_feel ?? 'good',
    recent_comparable_workload: getComparableWorkload(events),
    pitch_arsenal: pitcher.pitch_arsenal,
  };
}

function buildPitchBuckets(pitchArsenal: string[]) {
  const fastball =
    pitchArsenal.find((pitch) => /fastball|sinker|cutter/i.test(pitch)) ?? 'Fastball';
  const changeup =
    pitchArsenal.find((pitch) => /change/i.test(pitch)) ?? 'Changeup';
  const breaking =
    pitchArsenal.find((pitch) => /slider|curve|breaking/i.test(pitch)) ?? 'Breaking ball';

  return { fastball, changeup, breaking };
}

function allocateFromShares(totalPitches: number, shares: number[]) {
  const raw = shares.map((share) => Math.round(totalPitches * share));
  const difference = totalPitches - raw.reduce((sum, value) => sum + value, 0);

  if (difference === 0) {
    return raw;
  }

  raw[0] += difference;
  return raw;
}

function buildPitchMixRecommendation(
  totalPitches: number,
  focus: RecommendationBullpenFocus,
  pitchArsenal: string[]
): BullpenRecommendationPitchMixItem[] {
  const buckets = buildPitchBuckets(pitchArsenal);

  switch (focus) {
    case 'changeup_feel': {
      const [fastball, changeup, breaking] = allocateFromShares(totalPitches, [0.45, 0.35, 0.2]);
      return [
        { pitch_type: buckets.fastball, target_pitches: fastball, share_percent: 45, intent: 'Keep fastball feel and shape honest.' },
        { pitch_type: buckets.changeup, target_pitches: changeup, share_percent: 35, intent: 'Build changeup conviction and finish.' },
        { pitch_type: buckets.breaking, target_pitches: breaking, share_percent: 20, intent: 'Touch the breaking ball without overloading it.' },
      ];
    }
    case 'breaking_ball_feel': {
      const [fastball, breaking, changeup] = allocateFromShares(totalPitches, [0.5, 0.35, 0.15]);
      return [
        { pitch_type: buckets.fastball, target_pitches: fastball, share_percent: 50, intent: 'Anchor direction and release point.' },
        { pitch_type: buckets.breaking, target_pitches: breaking, share_percent: 35, intent: 'Build shape and consistent strike feel.' },
        { pitch_type: buckets.changeup, target_pitches: changeup, share_percent: 15, intent: 'Keep offspeed touch in the mix.' },
      ];
    }
    case 'sequence_work': {
      const [fastball, changeup, breaking] = allocateFromShares(totalPitches, [0.5, 0.2, 0.3]);
      return [
        { pitch_type: buckets.fastball, target_pitches: fastball, share_percent: 50, intent: 'Set counts and drive the sequence plan.' },
        { pitch_type: buckets.changeup, target_pitches: changeup, share_percent: 20, intent: 'Use offspeed to change speeds in sequence work.' },
        { pitch_type: buckets.breaking, target_pitches: breaking, share_percent: 30, intent: 'Finish or steal strikes with a breaker.' },
      ];
    }
    case 'recovery_touch_and_feel': {
      const [fastball, changeup, breaking] = allocateFromShares(totalPitches, [0.7, 0.2, 0.1]);
      return [
        { pitch_type: buckets.fastball, target_pitches: fastball, share_percent: 70, intent: 'Easy catch-play rhythm and clean direction.' },
        { pitch_type: buckets.changeup, target_pitches: changeup, share_percent: 20, intent: 'Light touch and finish without forcing it.' },
        { pitch_type: buckets.breaking, target_pitches: breaking, share_percent: 10, intent: 'Minimal touch only if the arm feels good.' },
      ];
    }
    case 'outing_prep': {
      const [fastball, breaking, changeup] = allocateFromShares(totalPitches, [0.55, 0.25, 0.2]);
      return [
        { pitch_type: buckets.fastball, target_pitches: fastball, share_percent: 55, intent: 'Get game-speed fastball execution early.' },
        { pitch_type: buckets.breaking, target_pitches: breaking, share_percent: 25, intent: 'Touch the primary put-away or strike-steal pitch.' },
        { pitch_type: buckets.changeup, target_pitches: changeup, share_percent: 20, intent: 'Keep the offspeed option game-ready.' },
      ];
    }
    default: {
      const [fastball, changeup, breaking] = allocateFromShares(totalPitches, [0.6, 0.2, 0.2]);
      return [
        { pitch_type: buckets.fastball, target_pitches: fastball, share_percent: 60, intent: 'Drive command to both sides with the fastball.' },
        { pitch_type: buckets.changeup, target_pitches: changeup, share_percent: 20, intent: 'Support fastball command with a feel secondary.' },
        { pitch_type: buckets.breaking, target_pitches: breaking, share_percent: 20, intent: 'Finish the set with controlled breaker reps.' },
      ];
    }
  }
}

function buildWorkBlocks(
  totalPitches: number,
  focus: RecommendationBullpenFocus
): BullpenRecommendationWorkBlock[] {
  const [blockOne, blockTwo, blockThree] = allocateFromShares(totalPitches, [0.35, 0.35, 0.3]);

  switch (focus) {
    case 'changeup_feel':
      return [
        { label: 'Fastball foundation', target_pitches: blockOne, intent: 'Establish direction and release point with mostly fastball work.' },
        { label: 'Changeup feel', target_pitches: blockTwo, intent: 'Build changeup shape and intent without rushing volume.' },
        { label: 'Paired execution', target_pitches: blockThree, intent: 'Pair fastball and changeup in short execution sets.' },
      ];
    case 'breaking_ball_feel':
      return [
        { label: 'Fastball line', target_pitches: blockOne, intent: 'Start with fastball rhythm and strike direction.' },
        { label: 'Breaking-ball feel', target_pitches: blockTwo, intent: 'Focus on shape, finish, and strike feel.' },
        { label: 'Blend and finish', target_pitches: blockThree, intent: 'Mix fastball and breaker without chasing extra volume.' },
      ];
    case 'sequence_work':
      return [
        { label: 'Count starters', target_pitches: blockOne, intent: 'Work strike-one fastball and leverage-count shapes.' },
        { label: 'Sequence sets', target_pitches: blockTwo, intent: 'Throw short hitter-count sequences with intent.' },
        { label: 'Finish-up execution', target_pitches: blockThree, intent: 'Close with game-like pitch calls, not max effort.' },
      ];
    case 'recovery_touch_and_feel':
      return [
        { label: 'Easy catch-play rhythm', target_pitches: blockOne, intent: 'Keep tempo relaxed and the arm quiet.' },
        { label: 'Touch-and-feel secondaries', target_pitches: blockTwo, intent: 'Lightly feel secondaries without force or volume chase.' },
        { label: 'Controlled finish', target_pitches: blockThree, intent: 'End early if the arm feel slips.' },
      ];
    case 'outing_prep':
      return [
        { label: 'Fastball readiness', target_pitches: blockOne, intent: 'Establish game-speed fastball execution.' },
        { label: 'Outing sequence block', target_pitches: blockTwo, intent: 'Run the likely sequence package for the next outing.' },
        { label: 'Short finish-up', target_pitches: blockThree, intent: 'Finish with crisp execution, not extra volume.' },
      ];
    default:
      return [
        { label: 'Command foundation', target_pitches: blockOne, intent: 'Build consistent fastball strike direction early.' },
        { label: 'Focus block', target_pitches: blockTwo, intent: 'Reinforce the main bullpen focus with controlled reps.' },
        { label: 'Short execution finish', target_pitches: blockThree, intent: 'Close with quality reps and leave some bullets in the tank.' },
      ];
  }
}

export function generateBullpenRecommendation(
  input: BullpenRecommendationInput
): BullpenRecommendationOutput {
  const phasePreset = PHASE_PRESETS[input.development_phase];
  let recommendedPitchCount = phasePreset.pitch_count;
  let recommendedIntensity = phasePreset.intensity;
  const coachingNotes: string[] = [];
  const cautionNotes: string[] = [];
  const appliedRules: string[] = [
    `Started from the ${input.development_phase.replace('_', ' ')} preset (${phasePreset.pitch_count} pitches, ${phasePreset.intensity} intensity).`,
  ];

  if (input.days_since_last_throwing_event !== null) {
    if (input.days_since_last_throwing_event <= 1) {
      recommendedPitchCount -= 10;
      recommendedIntensity = lowerIntensity(recommendedIntensity, 'low');
      cautionNotes.push('Very recent throwing work: keep the bullpen short and controlled.');
      appliedRules.push('Reduced volume by 10 pitches because the last throwing event was within 1 day.');
    } else if (input.days_since_last_throwing_event === 2) {
      recommendedPitchCount -= 6;
      recommendedIntensity = lowerIntensity(recommendedIntensity, 'medium');
      cautionNotes.push('Recent throwing load is still fresh enough to avoid a full-volume jump.');
      appliedRules.push('Reduced volume by 6 pitches because the last throwing event was 2 days ago.');
    }
  }

  if (input.days_since_last_high_intensity_event !== null) {
    if (input.days_since_last_high_intensity_event <= 2) {
      recommendedPitchCount -= 8;
      recommendedIntensity = lowerIntensity(recommendedIntensity, 'medium');
      cautionNotes.push('High-intensity work was very recent, so keep intent under control.');
      appliedRules.push('Reduced volume by 8 pitches because a high-intensity event was within 2 days.');
    } else if (input.days_since_last_high_intensity_event <= 4) {
      recommendedPitchCount -= 4;
      appliedRules.push('Reduced volume by 4 pitches because a high-intensity event was within 4 days.');
    }
  }

  if (input.last_outing_type === 'game_outing') {
    recommendedPitchCount -= 6;
    recommendedIntensity = lowerIntensity(recommendedIntensity, 'medium');
    cautionNotes.push('Recent game outings get a more cautious bullpen follow-up than lighter throwing events.');
    appliedRules.push('Reduced volume by 6 pitches because the last outing type was a game outing.');
  } else if (input.last_outing_type === 'live_ab') {
    recommendedPitchCount -= 4;
    appliedRules.push('Reduced volume by 4 pitches because the last outing type was live AB.');
  }

  if (input.recent_total_workload >= 90) {
    recommendedPitchCount -= 8;
    cautionNotes.push('Recent workload is elevated across the last few events.');
    appliedRules.push('Reduced volume by 8 pitches because recent total workload is 90+ pitches.');
  } else if (input.recent_total_workload >= 55) {
    recommendedPitchCount -= 4;
    appliedRules.push('Reduced volume by 4 pitches because recent total workload is 55+ pitches.');
  }

  switch (input.arm_feel) {
    case 'neutral':
      recommendedPitchCount -= 4;
      recommendedIntensity = lowerIntensity(recommendedIntensity, 'medium');
      cautionNotes.push('Neutral arm feel: stay clean and avoid stretching volume.');
      appliedRules.push('Reduced volume by 4 pitches because arm feel is neutral.');
      break;
    case 'sore':
      recommendedPitchCount -= 10;
      recommendedIntensity = 'low';
      cautionNotes.push('Sore arm feel: keep the session low-intensity and stop early if feel drops.');
      appliedRules.push('Reduced volume by 10 pitches and capped intensity at low because arm feel is sore.');
      break;
    case 'pain':
      recommendedPitchCount -= 16;
      recommendedIntensity = 'low';
      cautionNotes.push('Pain is not a normal readiness signal. Pull volume down and reassess before full bullpen work.');
      appliedRules.push('Reduced volume by 16 pitches and capped intensity at low because arm feel is pain.');
      break;
    case 'great':
      coachingNotes.push('Arm feel is excellent, but the plan still respects recent workload history.');
      break;
    default:
      break;
  }

  if (input.recent_comparable_workload !== null) {
    const cappedPitchCount = Math.min(
      recommendedPitchCount,
      input.recent_comparable_workload + MAX_COMPARABLE_JUMP
    );

    if (cappedPitchCount !== recommendedPitchCount) {
      appliedRules.push(
        `Capped volume to ${cappedPitchCount} pitches to avoid jumping more than ${MAX_COMPARABLE_JUMP} pitches above recent comparable work.`
      );
      recommendedPitchCount = cappedPitchCount;
    }
  }

  recommendedPitchCount = clampPitchCount(recommendedPitchCount);

  const recommendedPitchMix = buildPitchMixRecommendation(
    recommendedPitchCount,
    input.bullpen_focus,
    input.pitch_arsenal
  );
  const recommendedWorkBlocks = buildWorkBlocks(
    recommendedPitchCount,
    input.bullpen_focus
  );

  coachingNotes.push(
    `Bullpen focus is ${input.bullpen_focus.replace(/_/g, ' ')}. Keep the session purpose narrow and leave room for recovery.`
  );

  if (input.development_phase === 'early_preseason') {
    coachingNotes.push('Early preseason stays controlled: build rhythm and repeatability before chasing heavier prep volumes.');
  }

  if (input.development_phase === 'mid_season' && input.bullpen_focus === 'outing_prep') {
    coachingNotes.push('In-season outing prep can be crisp and intentful, but it should still finish before quality drops.');
  }

  return {
    input_snapshot: input,
    recommended_total_pitch_count: recommendedPitchCount,
    recommended_intensity: recommendedIntensity,
    recommended_pitch_mix: recommendedPitchMix,
    recommended_work_blocks: recommendedWorkBlocks,
    coaching_notes: coachingNotes,
    caution_notes: cautionNotes,
    applied_rules: appliedRules,
  };
}
