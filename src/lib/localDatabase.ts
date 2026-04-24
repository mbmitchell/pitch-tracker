import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

let databasePromise: Promise<SQLiteDatabase> | null = null;
let initializationPromise: Promise<void> | null = null;
let initialized = false;

async function runSchemaStatement(
  db: SQLiteDatabase,
  statement: string,
  index: number
) {
  try {
    await db.runAsync(statement);
  } catch (error) {
    throw new Error(
      `Offline database schema statement ${index + 1} failed: ${statement}`,
      { cause: error }
    );
  }
}

async function applyOfflineSchema(db: SQLiteDatabase) {
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS cached_pitcher_profiles (
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
      updated_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_cached_pitcher_profiles_coach
      ON cached_pitcher_profiles (coach_id, last_name, first_name);`,
    `CREATE TABLE IF NOT EXISTS cached_throwing_events (
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
      updated_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_cached_throwing_events_coach_date
      ON cached_throwing_events (coach_id, date DESC, created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_cached_throwing_events_pitcher
      ON cached_throwing_events (pitcher_id, date DESC, created_at DESC);`,
    `CREATE TABLE IF NOT EXISTS cached_event_pitch_breakdown (
      id TEXT PRIMARY KEY NOT NULL,
      coach_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      pitch_type TEXT NOT NULL,
      pitch_count INTEGER NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_cached_event_pitch_breakdown_event
      ON cached_event_pitch_breakdown (event_id);`,
    `CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      coach_id TEXT NOT NULL,
      mutation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    `CREATE INDEX IF NOT EXISTS idx_sync_queue_coach_status
      ON sync_queue (coach_id, status, created_at);`,
    `CREATE TABLE IF NOT EXISTS local_pitcher_profiles (
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
    );`,
    `CREATE INDEX IF NOT EXISTS idx_local_pitcher_profiles_coach
      ON local_pitcher_profiles (coach_id, last_name, first_name);`,
    `CREATE TABLE IF NOT EXISTS local_throwing_events (
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
    );`,
    `CREATE INDEX IF NOT EXISTS idx_local_throwing_events_coach_date
      ON local_throwing_events (coach_id, date DESC, created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_local_throwing_events_pitcher
      ON local_throwing_events (pitcher_id, date DESC, created_at DESC);`,
    `CREATE TABLE IF NOT EXISTS local_event_pitch_breakdown (
      id TEXT PRIMARY KEY NOT NULL,
      coach_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      pitch_type TEXT NOT NULL,
      pitch_count INTEGER NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'synced'
    );`,
    `CREATE INDEX IF NOT EXISTS idx_local_event_pitch_breakdown_event
      ON local_event_pitch_breakdown (event_id);`,
    `CREATE TABLE IF NOT EXISTS local_sync_queue (
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
    );`,
    `CREATE INDEX IF NOT EXISTS idx_local_sync_queue_coach_status
      ON local_sync_queue (coach_id, status, created_at);`,
  ];

  try {
    await db.getAllAsync(`PRAGMA journal_mode = WAL;`);
  } catch (error) {
    throw new Error('Offline database PRAGMA journal_mode setup failed.', {
      cause: error,
    });
  }

  for (const [index, statement] of schemaStatements.entries()) {
    await runSchemaStatement(db, statement, index);
  }

  let pitcherProfileColumns: Array<{ name: string }>;

  try {
    pitcherProfileColumns = await db.getAllAsync<{ name: string }>(
      `PRAGMA table_info(local_pitcher_profiles)`
    );
  } catch (error) {
    throw new Error('Offline database schema inspection failed for local_pitcher_profiles.', {
      cause: error,
    });
  }

  const hasTargetDateColumn = pitcherProfileColumns.some(
    (column) => column.name === 'target_game_ready_date'
  );

  if (!hasTargetDateColumn) {
    try {
      await db.runAsync(
        `ALTER TABLE local_pitcher_profiles ADD COLUMN target_game_ready_date TEXT;`
      );
    } catch (error) {
      throw new Error(
        'Offline database schema migration failed while adding target_game_ready_date.',
        { cause: error }
      );
    }
  }
}

async function ensureOfflineDatabaseInitialized(db: SQLiteDatabase) {
  if (initialized) {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = applyOfflineSchema(db)
      .then(() => {
        initialized = true;
      })
      .catch((error) => {
        initialized = false;
        throw new Error('Offline database initialization failed.', { cause: error });
      })
      .finally(() => {
        initializationPromise = null;
      });
  }

  return initializationPromise;
}

async function createDatabase() {
  const db = await openDatabaseAsync('bullpen-planner.db');
  await ensureOfflineDatabaseInitialized(db);

  return db;
}

/**
 * Ensures the shared offline SQLite database and tables exist.
 *
 * The schema creation is idempotent so callers can safely invoke this during
 * app startup or before any local repository work.
 *
 * @returns initialized SQLite database instance
 */
export function initializeOfflineDatabase() {
  return getLocalDatabase();
}

export function getLocalDatabase() {
  if (!databasePromise) {
    databasePromise = createDatabase().catch((error) => {
      databasePromise = null;
      initialized = false;
      throw error;
    });
  }

  return databasePromise;
}
