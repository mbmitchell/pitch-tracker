import { ThrowingEventRecord, isOutingEvent } from '@/services/events';
import {
  SuggestedPreseasonPhase,
  buildSuggestedPreseasonPhaseContext,
  calculateDaysSince,
} from '@/utils/workload';
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
export type RecommendationAgeGroup =
  | '12U'
  | '13_14U'
  | '15_16U'
  | '17_18U'
  | 'COLLEGE_PLUS';

export type BullpenRecommendationInput = {
  age_group: RecommendationAgeGroup;
  coach_selected_development_phase: PitcherProfile['development_phase'];
  development_phase: RecommendationPhase;
  target_game_ready_date: string | null;
  suggested_preseason_phase: SuggestedPreseasonPhase | null;
  days_until_target_game_ready_date: number | null;
  weeks_until_target_game_ready_date: number | null;
  days_since_last_throwing_event: number | null;
  days_since_last_outing: number | null;
  days_since_last_high_intensity_event: number | null;
  recent_total_workload: number;
  last_throwing_event_type: EventType | null;
  last_throwing_event_pitch_count: number | null;
  last_throwing_event_intensity: Intensity | null;
  last_outing_type: EventType | null;
  last_outing_pitch_count: number | null;
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

export type BullpenRecommendationMetadata = {
  plan_state: 'normal' | 'same_day_recovery';
  about_model_note: string;
  supporting_sources: string[];
  same_day_throwing_summary: {
    event_type: EventType | null;
    total_pitches: number | null;
    intensity: Intensity | null;
  } | null;
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
  metadata: BullpenRecommendationMetadata;
};

export type AssignedWorkoutPlanDetails = {
  pitch_mix: BullpenRecommendationPitchMixItem[];
  work_blocks: BullpenRecommendationWorkBlock[];
};

type PhaseModifier = {
  range_offset_ratio: number;
  intensity_cap: RecommendationIntensity;
  applied_rule: string;
};

type PreseasonBuildModifier = {
  baseline_volume_scale: number;
  intensity_cap: RecommendationIntensity;
  default_focus: RecommendationBullpenFocus;
  prefer_higher_of_current_baseline: boolean;
  applied_rule: string;
  coaching_note: string;
};

type PitchSmartRestBucket = {
  max_pitches: number;
  recommended_rest_days: number;
};

type PitchSmartAgeGroupDefaults = {
  game_pitch_count_anchor: number | null;
  bullpen_baseline_min: number;
  bullpen_baseline_max: number;
  bullpen_cap: number;
  bullpen_max_intensity: RecommendationIntensity;
  rest_guidance: PitchSmartRestBucket[];
};

type PitchMixCategory = 'fastball' | 'changeup' | 'breaking' | 'other';

type PitchMixTemplateItem = {
  category: PitchMixCategory;
  share_percent: number;
  intent: string;
};

type PitchMixRecommendationResult = {
  items: BullpenRecommendationPitchMixItem[];
  applied_rule: string | null;
  coaching_note: string | null;
};

// These modifiers work on top of the age-group baseline range so the bullpen
// plan stays explainable and easy to tune.
const PHASE_MODIFIERS: Record<RecommendationPhase, PhaseModifier> = {
  early_preseason: {
    range_offset_ratio: -0.35,
    intensity_cap: 'medium',
    applied_rule: 'Early preseason trims volume and caps intensity at medium.',
  },
  late_preseason: {
    range_offset_ratio: -0.1,
    intensity_cap: 'medium',
    applied_rule: 'Late preseason builds workload gradually.',
  },
  early_season: {
    range_offset_ratio: 0,
    intensity_cap: 'medium',
    applied_rule: 'Early season keeps workload normal but controlled.',
  },
  mid_season: {
    range_offset_ratio: 0.15,
    intensity_cap: 'high',
    applied_rule:
      'Mid-season uses a normal workload baseline and leaves recent-outing logic to handle caution.',
  },
  rebuild: {
    range_offset_ratio: -0.45,
    intensity_cap: 'low',
    applied_rule: 'Rebuild phase reduces workload meaningfully.',
  },
  recovery: {
    range_offset_ratio: -0.75,
    intensity_cap: 'low',
    applied_rule: 'Recovery phase keeps workload at the lowest level.',
  },
};

// These defaults adapt progressive throwing and mound-introduction concepts into
// a simple planning ladder. They are intentionally conservative and still sit
// underneath the existing age caps, rest logic, and arm-feel overrides.
const PRESEASON_BUILD_MODIFIERS: Record<
  SuggestedPreseasonPhase,
  PreseasonBuildModifier
> = {
  foundation_throwing: {
    baseline_volume_scale: 0.6,
    intensity_cap: 'low',
    default_focus: 'recovery_touch_and_feel',
    prefer_higher_of_current_baseline: false,
    applied_rule:
      'Foundation throwing keeps intent low and volume well below a full bullpen while catch-play and flat-ground feel are still the priority.',
    coaching_note:
      'Foundation throwing should emphasize rhythm, direction, and easy catch/flat-ground feel instead of chasing bullpen volume.',
  },
  buildup_throwing: {
    baseline_volume_scale: 0.75,
    intensity_cap: 'medium',
    default_focus: 'fastball_command',
    prefer_higher_of_current_baseline: false,
    applied_rule:
      'Build-up throwing increases volume gradually, but it still stays command-oriented and short of game-prep intensity.',
    coaching_note:
      'Build-up throwing is the bridge from general throwing into more structured command work, not a jump straight to full bullpen stress.',
  },
  flat_ground_to_mound_intro: {
    baseline_volume_scale: 0.85,
    intensity_cap: 'medium',
    default_focus: 'fastball_command',
    prefer_higher_of_current_baseline: false,
    applied_rule:
      'Flat-ground to mound intro keeps total volume controlled while mound exposure is introduced gradually.',
    coaching_note:
      'When the target date is still a few weeks away, light mound exposure is more important than expanding volume aggressively.',
  },
  mound_progression: {
    baseline_volume_scale: 0.95,
    intensity_cap: 'medium',
    default_focus: 'fastball_command',
    prefer_higher_of_current_baseline: true,
    applied_rule:
      'Mound progression allows more bullpen specificity, but it still builds from recent workload instead of jumping abruptly.',
    coaching_note:
      'Mound progression can get more structured, but quality and continuity still matter more than reaching a number.',
  },
  game_prep: {
    baseline_volume_scale: 1.05,
    intensity_cap: 'high',
    default_focus: 'outing_prep',
    prefer_higher_of_current_baseline: true,
    applied_rule:
      'Game prep can move toward game-like work, but only inside the existing age guardrails and recent-workload limits.',
    coaching_note:
      'Game prep should simulate intent and structure, not force a sudden late jump in workload.',
  },
  maintenance_readiness: {
    baseline_volume_scale: 0.9,
    intensity_cap: 'medium',
    default_focus: 'outing_prep',
    prefer_higher_of_current_baseline: false,
    applied_rule:
      'Maintenance readiness avoids late-cycle fatigue by holding readiness rather than trying to build new volume right before the target date.',
    coaching_note:
      'Inside the final week, the safest plan is usually to maintain sharpness and reduce fatigue risk instead of adding stress.',
  },
};

const AGE_GROUP_PRESEASON_SCALE: Record<RecommendationAgeGroup, number> = {
  '12U': 0.85,
  '13_14U': 0.92,
  '15_16U': 1,
  '17_18U': 1,
  COLLEGE_PLUS: 1.05,
};

const RECENT_WORKLOAD_EVENT_WINDOW = 3;
const MIN_RECOMMENDED_PITCHES = 8;
const MAX_RECOMMENDED_PITCHES = 80;
const RECOMMENDATION_SUPPORTING_SOURCES = ['MLB/USA Baseball Pitch Smart', 'ASMI'];
const RECOMMENDATION_ABOUT_MODEL_NOTE =
  "Default recommendations are informed by MLB/USA Baseball Pitch Smart workload guidance and progressive interval throwing principles commonly used in baseball throwing programs. Preseason recommendations use the pitcher's age, recent workload, arm feel, and target game-ready date to support a gradual build-up toward competition. Coaches should use judgment and follow applicable league, school, and medical guidance.";
const CONSERVATIVE_DEFAULT_AGE_GROUP: RecommendationAgeGroup = '12U';

/**
 * Pitch Smart-informed bullpen anchors used as safe starting points for Phase 1.
 *
 * These defaults adapt game-oriented workload guidance into bullpen planning ranges.
 * They intentionally bias toward conservative planning and should not be treated as
 * strict compliance logic or medical advice.
 */
export const PITCH_SMART_AGE_GROUP_DEFAULTS: Record<
  RecommendationAgeGroup,
  PitchSmartAgeGroupDefaults
> = {
  '12U': {
    game_pitch_count_anchor: 85,
    bullpen_baseline_min: 15,
    bullpen_baseline_max: 25,
    bullpen_cap: 30,
    bullpen_max_intensity: 'medium',
    rest_guidance: [
      { max_pitches: 20, recommended_rest_days: 0 },
      { max_pitches: 35, recommended_rest_days: 1 },
      { max_pitches: 50, recommended_rest_days: 2 },
      { max_pitches: 65, recommended_rest_days: 3 },
      { max_pitches: Number.POSITIVE_INFINITY, recommended_rest_days: 4 },
    ],
  },
  '13_14U': {
    game_pitch_count_anchor: 95,
    bullpen_baseline_min: 20,
    bullpen_baseline_max: 35,
    bullpen_cap: 40,
    bullpen_max_intensity: 'medium',
    rest_guidance: [
      { max_pitches: 20, recommended_rest_days: 0 },
      { max_pitches: 35, recommended_rest_days: 1 },
      { max_pitches: 50, recommended_rest_days: 2 },
      { max_pitches: 65, recommended_rest_days: 3 },
      { max_pitches: Number.POSITIVE_INFINITY, recommended_rest_days: 4 },
    ],
  },
  '15_16U': {
    game_pitch_count_anchor: 95,
    bullpen_baseline_min: 25,
    bullpen_baseline_max: 45,
    bullpen_cap: 55,
    bullpen_max_intensity: 'high',
    rest_guidance: [
      { max_pitches: 30, recommended_rest_days: 0 },
      { max_pitches: 45, recommended_rest_days: 1 },
      { max_pitches: 60, recommended_rest_days: 2 },
      { max_pitches: 75, recommended_rest_days: 3 },
      { max_pitches: Number.POSITIVE_INFINITY, recommended_rest_days: 4 },
    ],
  },
  '17_18U': {
    game_pitch_count_anchor: 105,
    bullpen_baseline_min: 30,
    bullpen_baseline_max: 60,
    bullpen_cap: 70,
    bullpen_max_intensity: 'high',
    rest_guidance: [
      { max_pitches: 30, recommended_rest_days: 0 },
      { max_pitches: 45, recommended_rest_days: 1 },
      { max_pitches: 60, recommended_rest_days: 2 },
      { max_pitches: 75, recommended_rest_days: 3 },
      { max_pitches: Number.POSITIVE_INFINITY, recommended_rest_days: 4 },
    ],
  },
  COLLEGE_PLUS: {
    game_pitch_count_anchor: null,
    bullpen_baseline_min: 40,
    bullpen_baseline_max: 70,
    bullpen_cap: 80,
    bullpen_max_intensity: 'high',
    rest_guidance: [
      { max_pitches: 30, recommended_rest_days: 0 },
      { max_pitches: 45, recommended_rest_days: 1 },
      { max_pitches: 60, recommended_rest_days: 2 },
      { max_pitches: 75, recommended_rest_days: 3 },
      { max_pitches: Number.POSITIVE_INFINITY, recommended_rest_days: 4 },
    ],
  },
};

function clampPitchCount(value: number, maxPitchCount = MAX_RECOMMENDED_PITCHES) {
  return Math.max(MIN_RECOMMENDED_PITCHES, Math.min(maxPitchCount, value));
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

function getBaselineRangeSpan(ageDefaults: PitchSmartAgeGroupDefaults) {
  return ageDefaults.bullpen_baseline_max - ageDefaults.bullpen_baseline_min;
}

function getAgeGroupBaselinePitchCount(ageDefaults: PitchSmartAgeGroupDefaults) {
  return Math.round(
    (ageDefaults.bullpen_baseline_min + ageDefaults.bullpen_baseline_max) / 2
  );
}

function applyVolumeReduction(current: number, reduction: number) {
  return Math.max(0, current - reduction);
}

function clampRecommendedPitchCount(
  pitchCount: number,
  ageDefaults: PitchSmartAgeGroupDefaults
) {
  if (pitchCount <= 0) {
    return 0;
  }

  return clampPitchCount(pitchCount, ageDefaults.bullpen_cap);
}

function getComparableWorkloadCap(comparableWorkload: number) {
  return Math.ceil(comparableWorkload * 1.25);
}

function sumRecentWorkload(events: ThrowingEventRecord[]) {
  return events
    .slice(0, RECENT_WORKLOAD_EVENT_WINDOW)
    .reduce((sum, event) => sum + (event.total_pitches ?? 0), 0);
}

function getMostRecentOuting(events: ThrowingEventRecord[]) {
  return events.find((event) => isOutingEvent(event.event_type)) ?? null;
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

/**
 * Maps a pitcher age into the guarded recommendation age buckets used by Phase 1.
 *
 * Missing age falls back to the most conservative group so the engine never becomes
 * more aggressive simply because athlete data is incomplete.
 *
 * @param age - pitcher age from the roster profile
 * @returns age group used by the recommendation engine
 */
export function getRecommendationAgeGroup(age: number | null): RecommendationAgeGroup {
  if (age === null || age === undefined) {
    return CONSERVATIVE_DEFAULT_AGE_GROUP;
  }

  if (age <= 12) {
    return '12U';
  }

  if (age <= 14) {
    return '13_14U';
  }

  if (age <= 16) {
    return '15_16U';
  }

  if (age <= 18) {
    return '17_18U';
  }

  return 'COLLEGE_PLUS';
}

function getRecommendedRestDaysForPitchCount(
  ageGroup: RecommendationAgeGroup,
  pitchCount: number | null
) {
  if (pitchCount === null || pitchCount <= 0) {
    return 0;
  }

  const defaults = PITCH_SMART_AGE_GROUP_DEFAULTS[ageGroup];
  const bucket = defaults.rest_guidance.find((item) => pitchCount <= item.max_pitches);

  return bucket?.recommended_rest_days ?? 0;
}

function getPhaseAdjustedStartingPoint(
  ageDefaults: PitchSmartAgeGroupDefaults,
  phase: RecommendationPhase
) {
  const modifier = PHASE_MODIFIERS[phase];
  const baseline = getAgeGroupBaselinePitchCount(ageDefaults);
  const span = getBaselineRangeSpan(ageDefaults);

  return {
    pitch_count: Math.max(0, Math.round(baseline + span * modifier.range_offset_ratio)),
    intensity: lowerIntensity(ageDefaults.bullpen_max_intensity, modifier.intensity_cap),
    applied_rule: modifier.applied_rule,
  };
}

function getPreseasonTargetPitchCount(
  ageGroup: RecommendationAgeGroup,
  ageDefaults: PitchSmartAgeGroupDefaults,
  suggestedPhase: SuggestedPreseasonPhase
) {
  const modifier = PRESEASON_BUILD_MODIFIERS[suggestedPhase];
  const baseline = getAgeGroupBaselinePitchCount(ageDefaults);
  const scaledTarget = Math.round(
    baseline * modifier.baseline_volume_scale * AGE_GROUP_PRESEASON_SCALE[ageGroup]
  );

  return Math.max(0, scaledTarget);
}

function isSequenceEligibleAgeGroup(ageGroup: RecommendationAgeGroup) {
  return ageGroup === '15_16U' || ageGroup === '17_18U' || ageGroup === 'COLLEGE_PLUS';
}

function canUseGameLikePreseasonFocus(
  input: BullpenRecommendationInput,
  preseasonTargetPitchCount: number
) {
  return (
    isSequenceEligibleAgeGroup(input.age_group) &&
    input.arm_feel !== 'neutral' &&
    input.arm_feel !== 'sore' &&
    input.arm_feel !== 'pain' &&
    (input.recent_comparable_workload ?? 0) >= Math.round(preseasonTargetPitchCount * 0.85) &&
    (input.days_since_last_high_intensity_event === null ||
      input.days_since_last_high_intensity_event > 2)
  );
}

function getPreseasonRecommendedFocus(
  input: BullpenRecommendationInput,
  suggestedPhase: SuggestedPreseasonPhase,
  preseasonTargetPitchCount: number
) {
  const modifier = PRESEASON_BUILD_MODIFIERS[suggestedPhase];

  switch (suggestedPhase) {
    case 'foundation_throwing':
      return input.arm_feel === 'good' || input.arm_feel === 'great'
        ? 'fastball_command'
        : modifier.default_focus;
    case 'buildup_throwing':
    case 'flat_ground_to_mound_intro':
      return input.bullpen_focus === 'changeup_feel' ? 'changeup_feel' : modifier.default_focus;
    case 'game_prep':
      return canUseGameLikePreseasonFocus(input, preseasonTargetPitchCount)
        ? input.bullpen_focus === 'sequence_work'
          ? 'sequence_work'
          : modifier.default_focus
        : 'fastball_command';
    case 'maintenance_readiness':
      return canUseGameLikePreseasonFocus(input, preseasonTargetPitchCount)
        ? modifier.default_focus
        : 'fastball_command';
    default:
      return input.bullpen_focus === 'sequence_work' ? 'fastball_command' : input.bullpen_focus;
  }
}

function shouldFlagPreseasonTimelineCaution(
  input: BullpenRecommendationInput,
  preseasonTargetPitchCount: number
) {
  if (input.days_until_target_game_ready_date === null) {
    return false;
  }

  if (input.days_until_target_game_ready_date > 14) {
    return false;
  }

  const comparableWorkload = input.recent_comparable_workload ?? 0;
  return comparableWorkload < Math.round(preseasonTargetPitchCount * 0.75);
}

/**
 * Builds the normalized recommendation input from a pitcher profile and recent history.
 *
 * This keeps UI screens thin and ensures the rules engine always receives the same
 * derived fields, including age group, outing recency, and comparable workload.
 *
 * @param pitcher - pitcher profile supplying age, phase, goals, and arsenal
 * @param events - recent throwing history in descending date order
 * @returns structured recommendation input consumed by the engine
 */
export function buildBullpenRecommendationInput(
  pitcher: PitcherProfile,
  events: ThrowingEventRecord[]
): BullpenRecommendationInput {
  const daysSinceLastThrowingEvent = events[0]
    ? calculateDaysSince(events[0].date)
    : null;
  const recentTotalWorkload = sumRecentWorkload(events);
  const lastOuting = getMostRecentOuting(events);
  const lastOutingType = lastOuting?.event_type ?? null;
  const targetDateContext = buildSuggestedPreseasonPhaseContext(
    pitcher.target_game_ready_date
  );
  const recommendationPhase = inferRecommendationPhase(
    pitcher,
    recentTotalWorkload,
    daysSinceLastThrowingEvent
  );

  return {
    age_group: getRecommendationAgeGroup(pitcher.age),
    coach_selected_development_phase: pitcher.development_phase,
    development_phase: recommendationPhase,
    target_game_ready_date: pitcher.target_game_ready_date,
    suggested_preseason_phase: targetDateContext?.suggested_phase ?? null,
    days_until_target_game_ready_date: targetDateContext?.days_until_target ?? null,
    weeks_until_target_game_ready_date: targetDateContext?.weeks_until_target ?? null,
    days_since_last_throwing_event: daysSinceLastThrowingEvent,
    days_since_last_outing: lastOuting ? calculateDaysSince(lastOuting.date) : null,
    days_since_last_high_intensity_event: getDaysSinceLastHighIntensityEvent(events),
    recent_total_workload: recentTotalWorkload,
    last_throwing_event_type: events[0]?.event_type ?? null,
    last_throwing_event_pitch_count: events[0]?.total_pitches ?? null,
    last_throwing_event_intensity: events[0]?.intensity ?? null,
    last_outing_type: lastOutingType,
    last_outing_pitch_count: lastOuting?.total_pitches ?? null,
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
  return pitchArsenal.reduce(
    (buckets, pitch) => {
      const normalizedPitch = pitch.trim();

      if (!normalizedPitch) {
        return buckets;
      }

      const category = getPitchMixCategory(normalizedPitch);
      buckets[category].push(normalizedPitch);
      buckets.all.push(normalizedPitch);

      return buckets;
    },
    {
      fastball: [] as string[],
      changeup: [] as string[],
      breaking: [] as string[],
      other: [] as string[],
      all: [] as string[],
    }
  );
}

function getPitchMixCategory(pitch: string): PitchMixCategory {
  if (/fastball|four[\s-]?seam|4[\s-]?seam|two[\s-]?seam|2[\s-]?seam|sinker|cutter/i.test(pitch)) {
    return 'fastball';
  }

  if (/change|split|splitter|fork/i.test(pitch)) {
    return 'changeup';
  }

  if (/slider|curve|slurve|breaker|breaking|knuckle[\s-]?curve/i.test(pitch)) {
    return 'breaking';
  }

  return 'other';
}

function getFallbackPitchCategories(category: PitchMixCategory): PitchMixCategory[] {
  switch (category) {
    case 'fastball':
      return ['fastball', 'changeup', 'other', 'breaking'];
    case 'changeup':
      return ['changeup', 'fastball', 'other', 'breaking'];
    case 'breaking':
      return ['breaking', 'fastball', 'changeup', 'other'];
    default:
      return ['other', 'fastball', 'changeup', 'breaking'];
  }
}

function getPitchMixCategoryLabel(category: PitchMixCategory) {
  switch (category) {
    case 'changeup':
      return 'changeup';
    case 'breaking':
      return 'breaking ball';
    case 'other':
      return 'secondary pitch';
    default:
      return 'fastball';
  }
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

function buildPitchMixTemplate(
  focus: RecommendationBullpenFocus
): PitchMixTemplateItem[] {
  switch (focus) {
    case 'changeup_feel':
      return [
        {
          category: 'fastball',
          share_percent: 45,
          intent: 'Keep fastball feel and shape honest.',
        },
        {
          category: 'changeup',
          share_percent: 35,
          intent: 'Build changeup conviction and finish.',
        },
        {
          category: 'breaking',
          share_percent: 20,
          intent: 'Touch the breaking ball without overloading it.',
        },
      ];
    case 'breaking_ball_feel':
      return [
        {
          category: 'fastball',
          share_percent: 50,
          intent: 'Anchor direction and release point.',
        },
        {
          category: 'breaking',
          share_percent: 35,
          intent: 'Build shape and consistent strike feel.',
        },
        {
          category: 'changeup',
          share_percent: 15,
          intent: 'Keep offspeed touch in the mix.',
        },
      ];
    case 'sequence_work':
      return [
        {
          category: 'fastball',
          share_percent: 50,
          intent: 'Set counts and drive the sequence plan.',
        },
        {
          category: 'changeup',
          share_percent: 20,
          intent: 'Use offspeed to change speeds in sequence work.',
        },
        {
          category: 'breaking',
          share_percent: 30,
          intent: 'Finish or steal strikes with a breaker.',
        },
      ];
    case 'recovery_touch_and_feel':
      return [
        {
          category: 'fastball',
          share_percent: 70,
          intent: 'Easy catch-play rhythm and clean direction.',
        },
        {
          category: 'changeup',
          share_percent: 20,
          intent: 'Light touch and finish without forcing it.',
        },
        {
          category: 'breaking',
          share_percent: 10,
          intent: 'Minimal touch only if the arm feels good.',
        },
      ];
    case 'outing_prep':
      return [
        {
          category: 'fastball',
          share_percent: 55,
          intent: 'Get game-speed fastball execution early.',
        },
        {
          category: 'breaking',
          share_percent: 25,
          intent: 'Touch the primary put-away or strike-steal pitch.',
        },
        {
          category: 'changeup',
          share_percent: 20,
          intent: 'Keep the offspeed option game-ready.',
        },
      ];
    default:
      return [
        {
          category: 'fastball',
          share_percent: 60,
          intent: 'Drive command to both sides with the fastball.',
        },
        {
          category: 'changeup',
          share_percent: 20,
          intent: 'Support fastball command with a feel secondary.',
        },
        {
          category: 'breaking',
          share_percent: 20,
          intent: 'Finish the set with controlled breaker reps.',
        },
      ];
  }
}

function buildPitchMixPercentages(counts: number[], totalPitches: number) {
  if (totalPitches <= 0 || counts.length === 0) {
    return counts.map(() => 0);
  }

  const percentages = counts.map((count) =>
    Math.round((count / totalPitches) * 100)
  );
  const difference =
    100 - percentages.reduce((sum, percentage) => sum + percentage, 0);

  if (difference !== 0) {
    percentages[0] += difference;
  }

  return percentages;
}

/**
 * Normalizes a template-driven pitch mix so it only uses the pitches actually
 * listed in the roster profile, then redistributes unsupported volume safely.
 *
 * @param totalPitches - bullpen pitch count after workload rules
 * @param template - focus-driven pitch mix template
 * @param pitchArsenal - configured pitcher arsenal from the profile
 * @returns normalized pitch mix plus optional adjustment messaging
 */
function normalizePitchMixByArsenal(
  totalPitches: number,
  template: PitchMixTemplateItem[],
  pitchArsenal: string[]
): PitchMixRecommendationResult {
  const buckets = buildPitchBuckets(pitchArsenal);

  if (totalPitches <= 0) {
    return { items: [], applied_rule: null, coaching_note: null };
  }

  if (buckets.all.length === 0) {
    return {
      items: [],
      applied_rule:
        'Skipped pitch-specific mix guidance because no pitch arsenal is configured on the pitcher profile.',
      coaching_note:
        'Add the pitcher’s arsenal to get pitch-specific mix guidance. The workload plan still stays valid without it.',
    };
  }

  const templateCounts = allocateFromShares(
    totalPitches,
    template.map((item) => item.share_percent / 100)
  );
  const pitchTotals = new Map<string, { count: number; intents: string[] }>();
  const pitchOrder: string[] = [];
  const missingCategories = new Set<PitchMixCategory>();

  template.forEach((item, index) => {
    const pitchType = resolvePitchTypeForCategory(item.category, buckets);

    if (pitchType.fallback_used) {
      missingCategories.add(item.category);
    }

    const existing = pitchTotals.get(pitchType.name);

    if (!existing) {
      pitchTotals.set(pitchType.name, {
        count: templateCounts[index],
        intents: [item.intent],
      });
      pitchOrder.push(pitchType.name);
      return;
    }

    existing.count += templateCounts[index];
    if (!existing.intents.includes(item.intent)) {
      existing.intents.push(item.intent);
    }
  });

  const counts = pitchOrder.map((pitchType) => pitchTotals.get(pitchType)?.count ?? 0);
  const percentages = buildPitchMixPercentages(counts, totalPitches);
  const items = pitchOrder.map((pitchType, index) => {
    const pitchData = pitchTotals.get(pitchType);

    return {
      pitch_type: pitchType,
      target_pitches: pitchData?.count ?? 0,
      share_percent: percentages[index] ?? 0,
      intent:
        pitchData?.intents[0] ??
        'Use this pitch to support the current bullpen focus without forcing extra volume.',
    };
  });

  if (buckets.all.length === 1) {
    return {
      items,
      applied_rule: `Pitch mix stayed with ${buckets.all[0]} only because that is the only pitch listed in the current arsenal.`,
      coaching_note:
        'Only one pitch is configured, so the session should stay centered on command, location, and feel with that pitch.',
    };
  }

  if (missingCategories.size === 0) {
    return { items, applied_rule: null, coaching_note: null };
  }

  const missingCategoryLabels = Array.from(missingCategories).map((category) =>
    getPitchMixCategoryLabel(category)
  );

  return {
    items,
    applied_rule: `Adjusted the pitch mix to the configured arsenal and redistributed ${missingCategoryLabels.join(
      ' / '
    )} volume to available pitches already listed on the profile.`,
    coaching_note:
      'The recommended mix only uses pitches already in the pitcher profile, so unsupported secondary work was folded back into available command/feel work.',
  };
}

function resolvePitchTypeForCategory(
  category: PitchMixCategory,
  buckets: ReturnType<typeof buildPitchBuckets>
) {
  const fallbackCategories = getFallbackPitchCategories(category);

  for (const fallbackCategory of fallbackCategories) {
    const pitchType = buckets[fallbackCategory][0];

    if (pitchType) {
      return {
        name: pitchType,
        fallback_used: fallbackCategory !== category,
      };
    }
  }

  return {
    name: buckets.all[0] ?? 'Fastball',
    fallback_used: true,
  };
}

function buildPitchMixRecommendation(
  totalPitches: number,
  focus: RecommendationBullpenFocus,
  pitchArsenal: string[]
): PitchMixRecommendationResult {
  return normalizePitchMixByArsenal(
    totalPitches,
    buildPitchMixTemplate(focus),
    pitchArsenal
  );
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

/**
 * Builds stored workout structure from a target pitch count, focus, and arsenal.
 *
 * Coach-assigned workouts reuse the same deterministic pitch-mix and work-block
 * logic as live recommendations so saved assignments stay aligned with the model.
 *
 * @param totalPitches - assigned target pitch count
 * @param focus - workout focus the coach selected
 * @param pitchArsenal - available pitches from the pitcher profile
 * @returns workout pitch mix and work blocks ready for persistence
 */
export function buildAssignedWorkoutPlanDetails(
  totalPitches: number,
  focus: RecommendationBullpenFocus,
  pitchArsenal: string[]
): AssignedWorkoutPlanDetails {
  return {
    pitch_mix: buildPitchMixRecommendation(totalPitches, focus, pitchArsenal).items,
    work_blocks: buildWorkBlocks(totalPitches, focus),
  };
}

function buildSameDayRecoveryWorkBlocks(): BullpenRecommendationWorkBlock[] {
  return [
    {
      label: 'Recovery',
      target_pitches: 0,
      intent: 'Skip additional throwing and focus on hydration, soft-tissue recovery, and general reset work.',
    },
    {
      label: 'Mobility',
      target_pitches: 0,
      intent: 'Use light shoulder, thoracic, and hip mobility work to help the body recover from the session already logged today.',
    },
    {
      label: 'Arm care',
      target_pitches: 0,
      intent: 'Complete the usual post-throw arm-care routine and stop if the arm feels worse instead of better.',
    },
  ];
}

function buildSameDayRecoveryRecommendation(
  input: BullpenRecommendationInput
): BullpenRecommendationOutput {
  return {
    input_snapshot: input,
    recommended_total_pitch_count: 0,
    recommended_intensity: 'low',
    recommended_pitch_mix: [],
    recommended_work_blocks: buildSameDayRecoveryWorkBlocks(),
    coaching_notes: [
      'You have already logged a throwing session today.',
      'No additional throwing recommended today.',
      'Suggested focus: recovery, mobility, and arm care.',
    ],
    caution_notes: [
      'Same-day workload is already on the board, so today should shift from build-up into recovery-focused work.',
    ],
    applied_rules: [
      'same_day_throwing_detected',
      'A throwing event is already logged for today, so the normal bullpen build was replaced with a recovery-only plan.',
    ],
    metadata: {
      plan_state: 'same_day_recovery',
      about_model_note: RECOMMENDATION_ABOUT_MODEL_NOTE,
      supporting_sources: RECOMMENDATION_SUPPORTING_SOURCES,
      same_day_throwing_summary: {
        event_type: input.last_throwing_event_type,
        total_pitches: input.last_throwing_event_pitch_count,
        intensity: input.last_throwing_event_intensity,
      },
    },
  };
}

/**
 * Generates a deterministic bullpen recommendation from workload, phase, and arm-feel inputs.
 *
 * The engine starts from guarded age-group defaults, then layers phase adjustments,
 * recent workload caution, and workload continuity rules so the output stays explainable
 * to coaches and safe by default.
 *
 * @param input - structured recommendation input prepared for the rules engine
 * @returns recommendation output rendered directly by the recommendation screen
 */
export function generateBullpenRecommendation(
  input: BullpenRecommendationInput
): BullpenRecommendationOutput {
  if (input.days_since_last_throwing_event === 0) {
    return buildSameDayRecoveryRecommendation(input);
  }

  const ageDefaults = PITCH_SMART_AGE_GROUP_DEFAULTS[input.age_group];
  const baselineSpan = getBaselineRangeSpan(ageDefaults);
  const phaseStart = getPhaseAdjustedStartingPoint(
    ageDefaults,
    input.development_phase
  );
  let recommendedPitchCount = phaseStart.pitch_count;
  let recommendedIntensity = phaseStart.intensity;
  let recommendedBullpenFocus = input.bullpen_focus;
  const coachingNotes: string[] = [];
  const cautionNotes: string[] = [];
  const appliedRules: string[] = [
    `Started from the ${input.age_group} bullpen baseline range of ${ageDefaults.bullpen_baseline_min}-${ageDefaults.bullpen_baseline_max} pitches with a hard cap of ${ageDefaults.bullpen_cap}.`,
    phaseStart.applied_rule,
  ];

  if (input.suggested_preseason_phase) {
    const preseasonModifier =
      PRESEASON_BUILD_MODIFIERS[input.suggested_preseason_phase];
    const preseasonTargetPitchCount = getPreseasonTargetPitchCount(
      input.age_group,
      ageDefaults,
      input.suggested_preseason_phase
    );

    recommendedPitchCount = preseasonModifier.prefer_higher_of_current_baseline
      ? Math.max(recommendedPitchCount, preseasonTargetPitchCount)
      : Math.min(recommendedPitchCount, preseasonTargetPitchCount);
    recommendedIntensity = lowerIntensity(
      recommendedIntensity,
      preseasonModifier.intensity_cap
    );
    recommendedBullpenFocus = getPreseasonRecommendedFocus(
      input,
      input.suggested_preseason_phase,
      preseasonTargetPitchCount
    );

    appliedRules.push(
      `Target-date build-up phase "${input.suggested_preseason_phase}" adjusted the working bullpen baseline toward ${preseasonTargetPitchCount} pitches and capped intensity at ${preseasonModifier.intensity_cap}.`
    );
    appliedRules.push(preseasonModifier.applied_rule);
    coachingNotes.push(preseasonModifier.coaching_note);

    if (
      (input.suggested_preseason_phase === 'game_prep' ||
        input.suggested_preseason_phase === 'maintenance_readiness') &&
      recommendedBullpenFocus === 'fastball_command' &&
      (input.bullpen_focus === 'sequence_work' || input.bullpen_focus === 'outing_prep')
    ) {
      appliedRules.push(
        'Kept the focus command-oriented because current workload and recovery signals do not yet support a full game-like sequence progression.'
      );
    }

    if (shouldFlagPreseasonTimelineCaution(input, preseasonTargetPitchCount)) {
      cautionNotes.push(
        'The target game-ready date is close relative to recent workload. Build steadily and avoid trying to make up readiness in one bullpen.'
      );
      appliedRules.push(
        `Added a timeline caution because the target date is ${input.days_until_target_game_ready_date} day(s) away and the recent comparable workload is still below the current preseason build target.`
      );
    }
  }

  if (input.last_outing_type === 'game_outing' && input.last_outing_pitch_count !== null) {
    const recommendedRestDays = getRecommendedRestDaysForPitchCount(
      input.age_group,
      input.last_outing_pitch_count
    );

    if (
      input.days_since_last_outing !== null &&
      input.days_since_last_outing < recommendedRestDays
    ) {
      // Game outing recovery windows are where the Pitch Smart-informed safety
      // logic matters most, so the engine cuts volume before it considers
      // development upside or bullpen intent.
      const restGap = recommendedRestDays - input.days_since_last_outing;
      const reduction = restGap >= 2 ? Math.max(8, Math.round(baselineSpan * 0.6)) : 6;
      recommendedPitchCount = applyVolumeReduction(recommendedPitchCount, reduction);
      recommendedIntensity = lowerIntensity(recommendedIntensity, 'medium');
      cautionNotes.push(
        'Recent outing workload is still inside a conservative Pitch Smart-informed rest window, so keep the bullpen shorter and more controlled.'
      );
      appliedRules.push(
        `Reduced volume by ${reduction} pitches because the most recent outing logged ${input.last_outing_pitch_count} pitches and the ${input.age_group} rest guidance suggests about ${recommendedRestDays} day(s).`
      );
    } else {
      cautionNotes.push(
        `Recent game outing logged ${input.last_outing_pitch_count} pitches; the plan still respects ${input.age_group} rest guidance even though the immediate caution window appears clear.`
      );
    }
  }

  if (input.days_since_last_throwing_event !== null) {
    if (input.days_since_last_throwing_event <= 1) {
      // Back-to-back throwing sessions are the simplest high-risk workload case,
      // so the engine trims volume early and forces a low-intent session.
      const reduction = Math.max(6, Math.round(baselineSpan * 0.45));
      recommendedPitchCount = applyVolumeReduction(recommendedPitchCount, reduction);
      recommendedIntensity = lowerIntensity(recommendedIntensity, 'low');
      cautionNotes.push('Very recent throwing work: keep the bullpen short and controlled.');
      appliedRules.push(
        `Reduced volume by ${reduction} pitches because throwing work was logged within 1 day.`
      );
    }
  }

  if (input.days_since_last_high_intensity_event !== null) {
    if (input.days_since_last_high_intensity_event <= 2) {
      // Recent high-intensity work raises recovery risk even when the raw pitch
      // count was modest, so intensity is capped as well as volume.
      const reduction = Math.max(6, Math.round(baselineSpan * 0.35));
      recommendedPitchCount = applyVolumeReduction(recommendedPitchCount, reduction);
      recommendedIntensity = lowerIntensity(recommendedIntensity, 'medium');
      cautionNotes.push('High-intensity work was very recent, so keep intent under control.');
      appliedRules.push(
        `Reduced volume by ${reduction} pitches and capped intensity because a high-intensity event was within 2 days.`
      );
    } else if (input.days_since_last_high_intensity_event <= 4) {
      const reduction = Math.max(4, Math.round(baselineSpan * 0.2));
      recommendedPitchCount = applyVolumeReduction(recommendedPitchCount, reduction);
      recommendedIntensity = lowerIntensity(recommendedIntensity, 'medium');
      appliedRules.push(
        `Reduced volume by ${reduction} pitches because a high-intensity event was within 4 days.`
      );
    }
  }

  if (input.last_outing_type === 'game_outing') {
    recommendedPitchCount = applyVolumeReduction(recommendedPitchCount, 6);
    recommendedIntensity = lowerIntensity(recommendedIntensity, 'medium');
    cautionNotes.push('Recent game outings get a more cautious bullpen follow-up than lighter throwing events.');
    appliedRules.push('Reduced volume by 6 pitches because the last outing type was a game outing.');
  } else if (input.last_outing_type === 'live_ab') {
    recommendedPitchCount = applyVolumeReduction(recommendedPitchCount, 4);
    appliedRules.push('Reduced volume by 4 pitches because the last outing type was live AB.');
  }

  if (input.recent_total_workload >= 90) {
    recommendedPitchCount = applyVolumeReduction(recommendedPitchCount, 8);
    cautionNotes.push('Recent workload is elevated across the last few events.');
    appliedRules.push('Reduced volume by 8 pitches because recent total workload is 90+ pitches.');
  } else if (input.recent_total_workload >= 55) {
    recommendedPitchCount = applyVolumeReduction(recommendedPitchCount, 4);
    appliedRules.push('Reduced volume by 4 pitches because recent total workload is 55+ pitches.');
  }

  switch (input.arm_feel) {
    case 'neutral':
      // Phase 1 does not store a separate "tired" enum, so neutral is treated as
      // the practical caution bucket instead of assuming the athlete is fully fresh.
      recommendedPitchCount = applyVolumeReduction(
        recommendedPitchCount,
        Math.max(4, Math.round(baselineSpan * 0.2))
      );
      recommendedIntensity = lowerIntensity(recommendedIntensity, 'medium');
      cautionNotes.push(
        'Neutral arm feel is treated as the tired/caution bucket in Phase 1, so volume stays lighter and intensity stays controlled.'
      );
      appliedRules.push(
        'Reduced volume and lowered intensity because the current arm-feel signal is in the tired/neutral caution range.'
      );
      break;
    case 'sore':
      // Soreness changes the recommendation from "lighter bullpen" to
      // "recovery-only" because pushing bullpen intent through soreness is the
      // kind of judgment trap the model should actively avoid.
      recommendedPitchCount = 0;
      recommendedIntensity = 'low';
      cautionNotes.push(
        'Sore arm feel: no bullpen is recommended today. Recovery-only throwing should stay light and symptom-aware.'
      );
      appliedRules.push(
        'Reduced the bullpen plan to recovery-only work because arm feel is sore.'
      );
      break;
    case 'pain':
      recommendedPitchCount = 0;
      recommendedIntensity = 'low';
      cautionNotes.push(
        'Pain is not a normal readiness signal. No bullpen is recommended until the athlete is reassessed.'
      );
      appliedRules.push('Removed bullpen volume because arm feel is pain.');
      break;
    case 'great':
      coachingNotes.push('Arm feel is excellent, but the plan still respects recent workload history.');
      break;
    default:
      break;
  }

  if (input.recent_comparable_workload !== null) {
    // This continuity cap prevents abrupt workload spikes when the earlier rules
    // would otherwise allow a much larger session than the athlete has handled recently.
    const cappedPitchCount = Math.min(
      recommendedPitchCount,
      getComparableWorkloadCap(input.recent_comparable_workload)
    );

    if (cappedPitchCount !== recommendedPitchCount) {
      appliedRules.push(
        `Capped volume to ${cappedPitchCount} pitches to avoid increasing more than about 25% above the most recent comparable workload (${input.recent_comparable_workload}).`
      );
      recommendedPitchCount = cappedPitchCount;
    }
  }

  const cappedByAgeGroup = clampRecommendedPitchCount(
    recommendedPitchCount,
    ageDefaults
  );

  if (cappedByAgeGroup !== recommendedPitchCount) {
    // The age-group cap is always the final safety backstop, even if every
    // earlier rule would allow more volume.
    appliedRules.push(
      `Applied the ${input.age_group} bullpen cap of ${ageDefaults.bullpen_cap} pitches.`
    );
  }

  recommendedPitchCount = cappedByAgeGroup;
  recommendedIntensity = lowerIntensity(recommendedIntensity, ageDefaults.bullpen_max_intensity);

  const pitchMixRecommendation = buildPitchMixRecommendation(
    recommendedPitchCount,
    recommendedBullpenFocus,
    input.pitch_arsenal
  );
  const recommendedPitchMix = pitchMixRecommendation.items;
  const recommendedWorkBlocks = buildWorkBlocks(
    recommendedPitchCount,
    recommendedBullpenFocus
  );

  if (pitchMixRecommendation.applied_rule) {
    appliedRules.push(pitchMixRecommendation.applied_rule);
  }

  if (pitchMixRecommendation.coaching_note) {
    coachingNotes.push(pitchMixRecommendation.coaching_note);
  }

  coachingNotes.push(
    `Bullpen focus is ${recommendedBullpenFocus.replace(/_/g, ' ')}. Keep the session purpose narrow and leave room for recovery.`
  );
  coachingNotes.push(
    `${input.age_group} defaults are adapted conservatively from Pitch Smart-style game thresholds into bullpen planning guidance, not strict compliance rules.`
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
    metadata: {
      plan_state: 'normal',
      about_model_note: RECOMMENDATION_ABOUT_MODEL_NOTE,
      supporting_sources: RECOMMENDATION_SUPPORTING_SOURCES,
      same_day_throwing_summary: null,
    },
  };
}
