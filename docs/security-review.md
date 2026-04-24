# Bullpen Planner Security Review

Review date: 2026-04-24

Scope reviewed:
- Expo / React Native client
- Supabase Auth session handling
- Supabase database access patterns
- Supabase schema migrations
- offline SQLite cache and sync queue
- environment variable handling
- local development safety

Reviewed files:
- [src/lib/supabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/supabase.ts)
- [src/services/auth.tsx](/Users/mmitchell/dev/pitch-tracker/src/services/auth.tsx)
- [src/services/pitchers.ts](/Users/mmitchell/dev/pitch-tracker/src/services/pitchers.ts)
- [src/services/events.ts](/Users/mmitchell/dev/pitch-tracker/src/services/events.ts)
- [src/services/sync.tsx](/Users/mmitchell/dev/pitch-tracker/src/services/sync.tsx)
- [src/lib/localDatabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/localDatabase.ts)
- [src/features/sync/screens/SyncDetailsScreen.tsx](/Users/mmitchell/dev/pitch-tracker/src/features/sync/screens/SyncDetailsScreen.tsx)
- [supabase/migrations/20260420160000_initial_bullpen_planner_schema.sql](/Users/mmitchell/dev/pitch-tracker/supabase/migrations/20260420160000_initial_bullpen_planner_schema.sql)
- [supabase/migrations/20260420183000_align_throwing_event_phase1_values.sql](/Users/mmitchell/dev/pitch-tracker/supabase/migrations/20260420183000_align_throwing_event_phase1_values.sql)
- [supabase/migrations/20260424110000_add_target_game_ready_date_to_pitcher_profiles.sql](/Users/mmitchell/dev/pitch-tracker/supabase/migrations/20260424110000_add_target_game_ready_date_to_pitcher_profiles.sql)

## Summary

Current setup is functional for development, but it is not yet production-safe from a data-isolation perspective.

Top concerns:
1. Database tables in `public` are created without RLS enablement or policies.
2. Auth sessions and offline data are stored locally without OS-backed secure storage or encryption.
3. Local cached data is not cleared on sign-out, so coach data remains on-device longer than necessary.

What looks good:
- No service-role key exposure was found in the app code.
- Client writes consistently stamp `created_by` / `entered_by_user_id` with the signed-in coach id.
- Offline queue records are scoped by `coach_id`, which helps with in-app filtering.

## Findings

### Critical

#### 1. RLS is not enabled or defined for app tables in `public`

- File/location:
  - [20260420160000_initial_bullpen_planner_schema.sql](/Users/mmitchell/dev/pitch-tracker/supabase/migrations/20260420160000_initial_bullpen_planner_schema.sql#L13)
  - [20260420183000_align_throwing_event_phase1_values.sql](/Users/mmitchell/dev/pitch-tracker/supabase/migrations/20260420183000_align_throwing_event_phase1_values.sql#L1)
- Risk:
  - `pitcher_profiles`, `throwing_events`, and `event_pitch_breakdown` are created in the exposed `public` schema, but the migrations do not include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` or any `CREATE POLICY` statements.
  - Per Supabase’s guidance, tables created with raw SQL in `public` need RLS enabled manually. Without that, coach-to-coach isolation is not enforceable at the database layer.
  - This is the single largest risk in the current setup because the client is using the public Supabase key from a mobile app.
- Recommended fix:
  - Add a migration that:
    - enables RLS on all three app tables
    - adds explicit `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies
  - Policies should enforce ownership through relationships, not just direct columns:
    - `pitcher_profiles`: `created_by = auth.uid()`
    - `throwing_events`: `entered_by_user_id = auth.uid()` and referenced `pitcher_id` must belong to a pitcher created by `auth.uid()`
    - `event_pitch_breakdown`: referenced `event_id` must belong to a `throwing_event` owned by `auth.uid()`
  - Add policy verification tests before calling Phase 1 production-ready.
- Fix timing: Fix now

### High

#### 2. Supabase auth session is persisted in SQLite-backed local storage instead of OS secure storage

- File/location:
  - [src/lib/supabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/supabase.ts#L1)
- Risk:
  - The app installs `expo-sqlite/localStorage` and passes `globalThis.localStorage` to the Supabase auth client for persisted sessions.
  - That means access and refresh tokens are stored in app-local persistent storage instead of the native secure enclave / keychain equivalents.
  - On a compromised, rooted, jailbroken, or shared test device, token theft risk is higher than necessary.
- Recommended fix:
  - Replace native auth storage with an `expo-secure-store` adapter for Supabase sessions.
  - Keep plain `localStorage` only for web if needed.
  - Document that native sessions should use OS-backed storage by default.
- Fix timing: Fix now

#### 3. Offline cache and sync queue persist sensitive coach and pitcher data unencrypted at rest

- File/location:
  - [src/lib/localDatabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/localDatabase.ts#L12)
  - [src/lib/localDatabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/localDatabase.ts#L62)
  - [src/lib/localDatabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/localDatabase.ts#L77)
  - [src/lib/localDatabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/localDatabase.ts#L130)
- Risk:
  - The local SQLite database stores names, notes, goals, development phase, arm feel, event notes, and replayable `payload_json` blobs in plain text.
  - This is useful for offline support, but it increases data exposure on lost devices, device backups, and compromised local environments.
  - The queue also duplicates data that already exists in the cache, which increases retention surface.
- Recommended fix:
  - Short term:
    - minimize what gets stored in `payload_json`
    - remove or null queue payloads after successful sync
    - clear local data on sign-out or account switch
  - Longer term:
    - evaluate encrypting sensitive local fields or the local database at rest
    - define a retention strategy for old cached records
- Fix timing: Start now for retention/minimization, later for full encryption hardening

### Medium

#### 4. Sign-out does not clear cached coach data or queued offline mutations

- File/location:
  - [src/services/auth.tsx](/Users/mmitchell/dev/pitch-tracker/src/services/auth.tsx#L179)
  - [src/lib/localDatabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/localDatabase.ts#L12)
- Risk:
  - `signOut()` only signs out of Supabase. It does not clear the coach’s cached pitchers, events, breakdown rows, or queued mutations from SQLite.
  - On a shared device or a test device used by multiple accounts, prior coach data remains on-device after logout.
  - The current coach-id filtering reduces accidental in-app cross-account reads, but it does not reduce device-side retention risk.
- Recommended fix:
  - Clear local cache and sync queue on explicit sign-out.
  - If keeping multi-account local state is desired later, move to per-user namespacing with explicit account switching support.
- Fix timing: Fix now

#### 5. Production sync details expose raw backend error strings and internal entity ids

- File/location:
  - [src/features/sync/screens/SyncDetailsScreen.tsx](/Users/mmitchell/dev/pitch-tracker/src/features/sync/screens/SyncDetailsScreen.tsx#L81)
  - [src/features/sync/screens/SyncDetailsScreen.tsx](/Users/mmitchell/dev/pitch-tracker/src/features/sync/screens/SyncDetailsScreen.tsx#L85)
- Risk:
  - The Sync Details screen shows raw `last_error` messages and internal `entity_id` values to the signed-in user in production.
  - Those messages can expose database table names, constraint behavior, or other backend details that are useful for debugging but unnecessary for coaches.
- Recommended fix:
  - Replace raw backend errors with sanitized user-facing messages in production.
  - Keep full error detail behind a dev-only toggle or debug build.
  - Hide internal entity ids unless explicitly needed for developer troubleshooting.
- Fix timing: Fix later

#### 6. Queue payload retention is broader than needed for replay

- File/location:
  - [src/lib/localDatabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/localDatabase.ts#L62)
  - [src/lib/localDatabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/localDatabase.ts#L130)
  - [src/services/pitchers.ts](/Users/mmitchell/dev/pitch-tracker/src/services/pitchers.ts#L259)
  - [src/services/events.ts](/Users/mmitchell/dev/pitch-tracker/src/services/events.ts#L380)
- Risk:
  - Full insert/update payloads are serialized into `payload_json` for replay.
  - This is practical, but it means sensitive fields remain duplicated in queue storage even after the corresponding cache rows already exist.
  - If sync repeatedly fails, the data persists indefinitely in both cache and queue.
- Recommended fix:
  - Store only the fields required to replay each mutation.
  - Delete synced queue records entirely or blank out `payload_json` after success.
  - Add queue cleanup for old failed records after a retention window.
- Fix timing: Fix later

### Low

#### 7. Local development safety still depends on manual reset and manual schema verification

- File/location:
  - [src/lib/supabase.ts](/Users/mmitchell/dev/pitch-tracker/src/lib/supabase.ts#L52)
  - [src/features/sync/screens/SyncDetailsScreen.tsx](/Users/mmitchell/dev/pitch-tracker/src/features/sync/screens/SyncDetailsScreen.tsx#L199)
- Risk:
  - The app warns when env vars are missing and now has a dev reset path, but local developers can still run with stale cache, stale queue state, or unapplied schema/RLS changes.
  - This is mainly a local safety and review hygiene issue rather than an end-user exploit.
- Recommended fix:
  - Add a short release/dev checklist that requires:
    - env vars present
    - migrations applied
    - RLS verified
    - local offline cache reset after schema changes that affect sync
- Fix timing: Fix later

## Practical Recommendations

### Fix now

1. Add a dedicated RLS migration for all app tables.
2. Use `expo-secure-store` for native Supabase session persistence.
3. Clear local cache and sync queue on sign-out.
4. Add a small RLS verification checklist or automated test pass before any shared-environment deployment.

### Fix next

1. Sanitize Sync Details messages for production users.
2. Remove synced queue payloads or delete synced queue rows.
3. Reduce offline retention for duplicated sensitive fields.

### Fix later

1. Evaluate encrypting sensitive local offline data at rest.
2. Add release-oriented security checks to docs/CI.
3. Add policy tests that explicitly verify:
   - coach A cannot read coach B pitchers
   - coach A cannot create events for coach B pitchers
   - coach A cannot read or write breakdown rows for coach B events

## Suggested Remediation Plan

### Phase 0: Blockers

1. Create `supabase/migrations/*_enable_rls_and_policies.sql`.
2. Enable RLS on:
   - `pitcher_profiles`
   - `throwing_events`
   - `event_pitch_breakdown`
3. Add ownership policies for each table.
4. Test with two coach accounts before merging.

### Phase 1: Device-side hardening

1. Move Supabase native session storage to `expo-secure-store`.
2. Clear local SQLite cache and queue on sign-out.
3. Remove synced queue payloads after successful replay.

### Phase 2: UX and operational hardening

1. Sanitize sync errors for production UI.
2. Add an internal checklist for env vars, migrations, and RLS verification.
3. Decide whether Phase 1 offline data needs encryption at rest before broader rollout.

## References

- [Supabase: Row Level Security](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-row-level-security)
- [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
