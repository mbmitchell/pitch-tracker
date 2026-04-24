# Bullpen Planner Phase 1 Architecture Note

This note captures the current Phase 1 shape of the app and the intentional boundaries around it.

## What Phase 1 Includes

- Coach-centered authentication with Supabase email/password auth
- Coach-owned pitcher roster management
- Throwing event tracking as the core workload record
- Optional pitch breakdown rows per event
- Dashboard readiness summaries derived from recent throwing history
- Transparent, rules-based bullpen recommendations
- Local offline cache and queued sync for core Phase 1 create flows

## What Phase 1 Intentionally Defers

- Team management and shared staff workflows
- Pitcher-facing login and self-entry UX
- Role management and permissions UI
- Advanced conflict resolution for offline edits
- Rich reporting, analytics, and historical trend views
- Full game pitch-by-pitch tracking
- Messaging, notifications, and request workflows

## Current Ownership Model

- Supabase is the cloud source of truth.
- Each signed-in coach owns the Phase 1 data they create.
- `pitcher_profiles.created_by` ties a pitcher profile to the coach account that created it.
- Throwing events belong to pitcher profiles and are entered in the context of that coach-owned roster.
- Phase 1 assumes a single-coach ownership model rather than a shared team model.

## Offline-First Direction

- The app is moving in a practical offline-first direction for mobile use.
- Recent coach data is cached locally with Expo SQLite.
- Core create flows can be captured offline and queued for later sync.
- Supabase remains authoritative once connectivity returns.
- Conflict handling is intentionally conservative in Phase 1 so the sync layer stays understandable and maintainable.

## Future Extension Points

### Teams

- Introduce team entities and membership relationships instead of relying on single-coach ownership only.
- Allow shared visibility and eventually shared editing across staff accounts.

### Pitcher Login

- Keep user accounts and pitcher profiles as separate concepts.
- A future pitcher-auth flow can link an auth user to a pitcher profile without redesigning the current model.

### Pitcher Portability Across Teams

- Pitcher identity should remain distinct from team membership.
- A future model can support one pitcher moving between teams or seasons without losing longitudinal history.

### Future Game Pitch Tracking

- `throwing_events` is the workload anchor today.
- Detailed game pitch tracking can be added later as a deeper layer under outings rather than replacing the current event model.
- That future structure should preserve compatibility with recommendations, readiness, and workload summaries.
