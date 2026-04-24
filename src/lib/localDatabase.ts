import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

let databasePromise: Promise<SQLiteDatabase> | null = null;
let initialized = false;

async function createDatabase() {
  const db = await openDatabaseAsync('bullpen-planner.db');

  if (!initialized) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS local_pitcher_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        coach_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        age INTEGER,
        grade TEXT,
        level_team TEXT,
        target_game_ready_date TEXT,
        handedness TEXT NOT NULL,
        pitch_arsenal_json TEXT NOT NULL,
        development_phase TEXT NOT NULL,
        primary_goals TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_state TEXT NOT NULL DEFAULT 'synced'
      );

      CREATE INDEX IF NOT EXISTS idx_local_pitcher_profiles_coach
        ON local_pitcher_profiles (coach_id, last_name, first_name);

      CREATE TABLE IF NOT EXISTS local_throwing_events (
        id TEXT PRIMARY KEY NOT NULL,
        coach_id TEXT NOT NULL,
        pitcher_id TEXT NOT NULL,
        date TEXT NOT NULL,
        event_type TEXT NOT NULL,
        total_pitches INTEGER,
        innings_thrown REAL,
        intensity TEXT NOT NULL,
        arm_feel TEXT NOT NULL,
        bullpen_focus TEXT,
        notes TEXT,
        entered_by_user_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_state TEXT NOT NULL DEFAULT 'synced'
      );

      CREATE INDEX IF NOT EXISTS idx_local_throwing_events_coach_date
        ON local_throwing_events (coach_id, date DESC, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_local_throwing_events_pitcher
        ON local_throwing_events (pitcher_id, date DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS local_event_pitch_breakdown (
        id TEXT PRIMARY KEY NOT NULL,
        coach_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        pitch_type TEXT NOT NULL,
        pitch_count INTEGER NOT NULL,
        sync_state TEXT NOT NULL DEFAULT 'synced'
      );

      CREATE INDEX IF NOT EXISTS idx_local_event_pitch_breakdown_event
        ON local_event_pitch_breakdown (event_id);

      CREATE TABLE IF NOT EXISTS local_sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        coach_id TEXT NOT NULL,
        mutation_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_local_sync_queue_coach_status
        ON local_sync_queue (coach_id, status, created_at);
    `);

    const pitcherProfileColumns = await db.getAllAsync<{ name: string }>(
      `PRAGMA table_info(local_pitcher_profiles)`
    );
    const hasTargetDateColumn = pitcherProfileColumns.some(
      (column) => column.name === 'target_game_ready_date'
    );

    if (!hasTargetDateColumn) {
      await db.execAsync(
        `ALTER TABLE local_pitcher_profiles ADD COLUMN target_game_ready_date TEXT;`
      );
    }

    initialized = true;
  }

  return db;
}

export function getLocalDatabase() {
  if (!databasePromise) {
    databasePromise = createDatabase();
  }

  return databasePromise;
}
