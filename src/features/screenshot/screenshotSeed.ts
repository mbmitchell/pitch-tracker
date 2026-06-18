import {
  clearLocalOfflineData,
  replaceLocalAssignedWorkoutsForPitcher,
  replaceLocalPitchBreakdownForEvent,
  upsertLocalPitchers,
  upsertLocalThrowingEvents,
} from '@/services/localData';
import type {
  AssignedWorkout,
  EventPitchBreakdown,
  PitcherProfile,
  ThrowingEvent,
} from '@/types/models';

import {
  ScreenshotProfile,
  screenshotModeLog,
  screenshotProfileUserIds,
} from '@/features/screenshot/screenshotMode';

function shiftIsoDate(daysFromToday: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftIsoTimestamp(daysFromToday: number, hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString();
}

function buildCoachSeed(ownerId: string) {
  const pitchers: PitcherProfile[] = [
    {
      id: 'shot-coach-pitcher-mason',
      created_by: ownerId,
      first_name: 'Mason',
      last_name: 'Reed',
      age: 16,
      grade: '11',
      level_team: 'Varsity',
      target_game_ready_date: shiftIsoDate(14),
      handedness: 'RHP',
      pitch_arsenal: ['4-Seam', '2-Seam', 'Slider', 'Changeup'],
      development_phase: 'preseason',
      primary_goals: 'Fastball command to both sides and cleaner slider finish.',
      notes: 'Built for App Store screenshot capture. Keep the bullpen workflow clean and focused.',
      created_at: shiftIsoTimestamp(-20, 9, 30),
      updated_at: shiftIsoTimestamp(-2, 15, 15),
    },
    {
      id: 'shot-coach-pitcher-noah',
      created_by: ownerId,
      first_name: 'Noah',
      last_name: 'Kim',
      age: 15,
      grade: '10',
      level_team: 'JV',
      target_game_ready_date: shiftIsoDate(9),
      handedness: 'LHP',
      pitch_arsenal: ['4-Seam', 'Curveball', 'Changeup'],
      development_phase: 'build',
      primary_goals: 'Consistent tempo and glove-side fastball feel.',
      notes: 'Moderate readiness example for dashboard screenshots.',
      created_at: shiftIsoTimestamp(-18, 10, 0),
      updated_at: shiftIsoTimestamp(-1, 16, 20),
    },
    {
      id: 'shot-coach-pitcher-leo',
      created_by: ownerId,
      first_name: 'Leo',
      last_name: 'Carter',
      age: 17,
      grade: '12',
      level_team: 'Travel',
      target_game_ready_date: shiftIsoDate(6),
      handedness: 'RHP',
      pitch_arsenal: ['4-Seam', 'Slider', 'Splitter'],
      development_phase: 'in_season',
      primary_goals: 'Recover from recent outing and keep feel light.',
      notes: 'Rest/caution example for dashboard screenshots.',
      created_at: shiftIsoTimestamp(-24, 8, 45),
      updated_at: shiftIsoTimestamp(-1, 19, 5),
    },
  ];

  const events: ThrowingEvent[] = [
    {
      id: 'shot-coach-event-mason-1',
      pitcher_id: 'shot-coach-pitcher-mason',
      date: shiftIsoDate(-4),
      event_type: 'bullpen',
      total_pitches: 18,
      innings_thrown: null,
      intensity: 'low',
      arm_feel: 'good',
      bullpen_focus: 'command',
      notes: 'Short command bullpen with easy finish and clean recovery.',
      entered_by_user_id: ownerId,
      source_type: 'coach',
      created_at: shiftIsoTimestamp(-4, 15, 10),
      updated_at: shiftIsoTimestamp(-4, 15, 10),
    },
    {
      id: 'shot-coach-event-mason-2',
      pitcher_id: 'shot-coach-pitcher-mason',
      date: shiftIsoDate(-7),
      event_type: 'flat_ground',
      total_pitches: 22,
      innings_thrown: null,
      intensity: 'medium',
      arm_feel: 'good',
      bullpen_focus: 'mechanics',
      notes: 'Flat-ground blend of direction work and secondary feel.',
      entered_by_user_id: ownerId,
      source_type: 'coach',
      created_at: shiftIsoTimestamp(-7, 16, 0),
      updated_at: shiftIsoTimestamp(-7, 16, 0),
    },
    {
      id: 'shot-coach-event-noah-1',
      pitcher_id: 'shot-coach-pitcher-noah',
      date: shiftIsoDate(-2),
      event_type: 'bullpen',
      total_pitches: 32,
      innings_thrown: null,
      intensity: 'medium',
      arm_feel: 'neutral',
      bullpen_focus: 'secondary_pitches',
      notes: 'Mid-volume pen with breaking-ball feel work.',
      entered_by_user_id: ownerId,
      source_type: 'coach',
      created_at: shiftIsoTimestamp(-2, 17, 20),
      updated_at: shiftIsoTimestamp(-2, 17, 20),
    },
    {
      id: 'shot-coach-event-leo-1',
      pitcher_id: 'shot-coach-pitcher-leo',
      date: shiftIsoDate(-1),
      event_type: 'game_outing',
      total_pitches: 58,
      innings_thrown: 3,
      intensity: 'max',
      arm_feel: 'sore',
      bullpen_focus: null,
      notes: 'Recent game outing. Recovery and caution day.',
      entered_by_user_id: ownerId,
      source_type: 'coach',
      created_at: shiftIsoTimestamp(-1, 20, 5),
      updated_at: shiftIsoTimestamp(-1, 20, 5),
    },
  ];

  const breakdowns: Record<string, EventPitchBreakdown[]> = {
    'shot-coach-event-mason-1': [
      {
        id: 'shot-coach-breakdown-mason-1a',
        event_id: 'shot-coach-event-mason-1',
        pitch_type: '4-Seam',
        pitch_count: 10,
      },
      {
        id: 'shot-coach-breakdown-mason-1b',
        event_id: 'shot-coach-event-mason-1',
        pitch_type: 'Slider',
        pitch_count: 5,
      },
      {
        id: 'shot-coach-breakdown-mason-1c',
        event_id: 'shot-coach-event-mason-1',
        pitch_type: 'Changeup',
        pitch_count: 3,
      },
    ],
    'shot-coach-event-noah-1': [
      {
        id: 'shot-coach-breakdown-noah-1a',
        event_id: 'shot-coach-event-noah-1',
        pitch_type: '4-Seam',
        pitch_count: 18,
      },
      {
        id: 'shot-coach-breakdown-noah-1b',
        event_id: 'shot-coach-event-noah-1',
        pitch_type: 'Curveball',
        pitch_count: 9,
      },
      {
        id: 'shot-coach-breakdown-noah-1c',
        event_id: 'shot-coach-event-noah-1',
        pitch_type: 'Changeup',
        pitch_count: 5,
      },
    ],
    'shot-coach-event-leo-1': [
      {
        id: 'shot-coach-breakdown-leo-1a',
        event_id: 'shot-coach-event-leo-1',
        pitch_type: '4-Seam',
        pitch_count: 31,
      },
      {
        id: 'shot-coach-breakdown-leo-1b',
        event_id: 'shot-coach-event-leo-1',
        pitch_type: 'Slider',
        pitch_count: 19,
      },
      {
        id: 'shot-coach-breakdown-leo-1c',
        event_id: 'shot-coach-event-leo-1',
        pitch_type: 'Splitter',
        pitch_count: 8,
      },
    ],
  };

  return { breakdowns, events, pitchers };
}

function buildPlayerSeed(ownerId: string) {
  const pitcher: PitcherProfile = {
    id: 'shot-player-pitcher-evan',
    created_by: ownerId,
    first_name: 'Evan',
    last_name: 'Brooks',
    age: 16,
    grade: '11',
    level_team: 'Varsity',
    target_game_ready_date: shiftIsoDate(12),
    handedness: 'RHP',
    pitch_arsenal: ['4-Seam', 'Slider', 'Changeup'],
    development_phase: 'preseason',
    primary_goals: 'Stay on line, sharpen slider shape, and recover cleanly.',
    notes: 'Linked player demo profile for App Store screenshots.',
    created_at: shiftIsoTimestamp(-12, 10, 0),
    updated_at: shiftIsoTimestamp(-1, 13, 45),
  };

  const events: ThrowingEvent[] = [
    {
      id: 'shot-player-event-1',
      pitcher_id: pitcher.id,
      date: shiftIsoDate(-3),
      event_type: 'flat_ground',
      total_pitches: 24,
      innings_thrown: null,
      intensity: 'medium',
      arm_feel: 'good',
      bullpen_focus: 'mechanics',
      notes: 'Easy touch-and-feel work with short recovery catch play.',
      entered_by_user_id: ownerId,
      source_type: 'player',
      created_at: shiftIsoTimestamp(-3, 16, 30),
      updated_at: shiftIsoTimestamp(-3, 16, 30),
    },
    {
      id: 'shot-player-event-2',
      pitcher_id: pitcher.id,
      date: shiftIsoDate(-6),
      event_type: 'bullpen',
      total_pitches: 28,
      innings_thrown: null,
      intensity: 'medium',
      arm_feel: 'good',
      bullpen_focus: 'command',
      notes: 'Command-focused bullpen with clean finish and good recovery.',
      entered_by_user_id: ownerId,
      source_type: 'player',
      created_at: shiftIsoTimestamp(-6, 17, 0),
      updated_at: shiftIsoTimestamp(-6, 17, 0),
    },
  ];

  const workouts: AssignedWorkout[] = [
    {
      id: 'shot-player-workout-today',
      pitcher_id: pitcher.id,
      assigned_by_user_id: ownerId,
      planned_date: shiftIsoDate(0),
      title: 'Midweek command bullpen',
      focus: 'fastball_command',
      target_pitch_count: 26,
      intensity: 'medium',
      pitch_mix: [
        { pitch_type: '4-Seam', target_pitches: 14, share_percent: 54, intent: 'Command to both sides' },
        { pitch_type: 'Slider', target_pitches: 7, share_percent: 27, intent: 'Tight shape with finish' },
        { pitch_type: 'Changeup', target_pitches: 5, share_percent: 19, intent: 'Easy arm speed and feel' },
      ],
      work_blocks: [
        { label: 'Feel catch play', target_pitches: 8, intent: 'Build rhythm and timing' },
        { label: 'Command block', target_pitches: 10, intent: 'Fastball execution to both sides' },
        { label: 'Finish block', target_pitches: 8, intent: 'Secondary feel and clean finish' },
      ],
      coach_notes: 'Stay smooth early, then finish with glove-side fastball intent.',
      status: 'assigned',
      viewed_at: null,
      completed_at: null,
      pitcher_feedback: null,
      completed_throwing_event_id: null,
      created_at: shiftIsoTimestamp(-1, 18, 0),
      updated_at: shiftIsoTimestamp(-1, 18, 0),
    },
    {
      id: 'shot-player-workout-complete',
      pitcher_id: pitcher.id,
      assigned_by_user_id: ownerId,
      planned_date: shiftIsoDate(-2),
      title: 'Recovery touch-and-feel',
      focus: 'recovery_touch_and_feel',
      target_pitch_count: 18,
      intensity: 'low',
      pitch_mix: [
        { pitch_type: '4-Seam', target_pitches: 10, share_percent: 56, intent: 'Easy line and carry' },
        { pitch_type: 'Changeup', target_pitches: 8, share_percent: 44, intent: 'Loose feel without forcing speed' },
      ],
      work_blocks: [
        { label: 'Easy catch play', target_pitches: 10, intent: 'Recovery and rhythm' },
        { label: 'Finish on feel', target_pitches: 8, intent: 'Light changeup feel' },
      ],
      coach_notes: 'Keep the arm fresh and finish feeling better than you started.',
      status: 'completed',
      viewed_at: shiftIsoTimestamp(-2, 14, 0),
      completed_at: shiftIsoTimestamp(-2, 16, 20),
      pitcher_feedback: 'Arm felt loose and recovered well.',
      completed_throwing_event_id: 'shot-player-event-1',
      created_at: shiftIsoTimestamp(-4, 9, 45),
      updated_at: shiftIsoTimestamp(-2, 16, 20),
    },
  ];

  const breakdowns: Record<string, EventPitchBreakdown[]> = {
    'shot-player-event-2': [
      {
        id: 'shot-player-breakdown-2a',
        event_id: 'shot-player-event-2',
        pitch_type: '4-Seam',
        pitch_count: 16,
      },
      {
        id: 'shot-player-breakdown-2b',
        event_id: 'shot-player-event-2',
        pitch_type: 'Slider',
        pitch_count: 7,
      },
      {
        id: 'shot-player-breakdown-2c',
        event_id: 'shot-player-event-2',
        pitch_type: 'Changeup',
        pitch_count: 5,
      },
    ],
  };

  return { breakdowns, events, pitcher, workouts };
}

async function seedCoachMode(profile: ScreenshotProfile) {
  const ownerId = screenshotProfileUserIds[profile];
  const { breakdowns, events, pitchers } = buildCoachSeed(ownerId);

  await upsertLocalPitchers(ownerId, pitchers, 'synced');
  await upsertLocalThrowingEvents(ownerId, events, 'synced');

  for (const event of events) {
    await replaceLocalPitchBreakdownForEvent(
      ownerId,
      event.id,
      breakdowns[event.id] ?? [],
      'synced'
    );
  }
}

async function seedPlayerMode(profile: ScreenshotProfile) {
  const ownerId = screenshotProfileUserIds[profile];
  const { breakdowns, events, pitcher, workouts } = buildPlayerSeed(ownerId);

  await upsertLocalPitchers(ownerId, [pitcher], 'synced');
  await upsertLocalThrowingEvents(ownerId, events, 'synced');
  await replaceLocalAssignedWorkoutsForPitcher(ownerId, pitcher.id, workouts, 'synced');

  for (const event of events) {
    await replaceLocalPitchBreakdownForEvent(
      ownerId,
      event.id,
      breakdowns[event.id] ?? [],
      'synced'
    );
  }
}

/**
 * Resets the local offline database and installs deterministic screenshot data.
 *
 * The data is intentionally local-only so App Store screenshots can be prepared
 * without touching real users or depending on live backend records.
 */
export async function seedScreenshotDataForProfile(profile: ScreenshotProfile) {
  screenshotModeLog(`Resetting local data and seeding profile "${profile}".`);
  await clearLocalOfflineData();

  switch (profile) {
    case 'coach':
      await seedCoachMode(profile);
      screenshotModeLog('Coach demo data ready.');
      return;
    case 'player':
      await seedPlayerMode(profile);
      screenshotModeLog('Player demo data ready.');
      return;
    case 'player_setup':
      screenshotModeLog('Player setup demo mode ready with no linked profile.');
      return;
    default:
      return;
  }
}
