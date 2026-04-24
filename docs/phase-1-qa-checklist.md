# Bullpen Planner Phase 1 QA Checklist

This checklist is for quick manual verification of the coach-centered Phase 1 app.

## Setup

- Confirm `.env` has valid `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Confirm the Supabase Phase 1 schema and RLS policies are applied before testing.
- Start the app with the normal local dev flow and test on at least one mobile simulator/device.

## Core Flows

### 1. Sign in

- Open the app while signed out.
- Confirm unauthenticated routing lands on the sign-in screen.
- Sign in with a valid coach account.
- Confirm the app redirects to the dashboard.
- Confirm the session persists after a reload/app restart.

### 2. Create pitcher

- Go to `Pitchers` and tap `Add pitcher`.
- Enter the required fields and save.
- Confirm the pitcher detail screen opens after save.
- Confirm the new pitcher appears in the roster and dashboard views.

### 3. Edit pitcher

- Open an existing pitcher.
- Tap `Edit pitcher`.
- Change a few fields such as team, goals, or arsenal.
- Save and confirm the updated values appear on pitcher detail and in the roster where applicable.

### 4. Add bullpen event

- Open a pitcher and add a new event.
- Select `Bullpen`.
- Enter total pitches, intensity, arm feel, bullpen focus, and optional pitch breakdown.
- Save and confirm the event appears at the top of pitcher history.
- Confirm bullpen focus displays only for bullpen events.

### 5. Add game outing

- Add another event for the same pitcher.
- Select `Game outing`.
- Confirm `Innings thrown` is available.
- Save and confirm the outing appears in history with the correct date, type, and pitch count.
- Confirm the workload summary updates `Last outing` correctly.

### 6. Dashboard readiness

- Return to the dashboard after logging recent events.
- Confirm each pitcher row shows:
  - pitcher name
  - readiness label
  - last throwing date
  - last event type
  - recent pitch count
- Confirm the `Today at a Glance` cards match the roster state.
- Tap a readiness card and confirm it opens the filtered pitcher list.

### 7. Recommendation generation

- Open a pitcher with recent throwing history.
- Tap `View recommendations`.
- Confirm a recommendation loads with:
  - total pitch count
  - intensity
  - pitch mix
  - work blocks
  - coaching/caution notes
- Confirm the screen handles a pitcher with light or no history without crashing.

### 8. Offline create and reconnect sync

- With cached data already loaded, disable network access.
- Confirm cached pitchers and pitcher detail/history still open.
- Create a new pitcher while offline.
- Create a throwing event while offline.
- Confirm the sync indicator shows `Offline` or pending changes.
- Re-enable network access.
- Confirm the sync indicator progresses to `Syncing` and then `All changes synced`.
- Confirm the offline-created records remain visible after reconnect.

### 9. RLS isolation between two coach accounts

- Sign in as Coach A and create at least one pitcher and event.
- Sign out and sign in as Coach B.
- Confirm Coach B cannot see Coach A data in roster, dashboard, pitcher detail, or recommendations.
- Create Coach B data and repeat the check in reverse.

## Troubleshooting

### Missing env vars

- Symptom: auth/live data screens show configuration errors.
- Check that `.env` contains both Expo public Supabase vars.
- Restart Expo after changing env vars.

### Supabase schema not applied

- Symptom: sign-in works, but pitcher/event operations fail or tables appear missing.
- Apply the Phase 1 migrations to the target Supabase project.
- Re-test with a fresh signed-in session after schema changes.

### Offline queue not syncing

- Symptom: pending changes never clear after reconnecting.
- Confirm the device actually regained internet access.
- Confirm Supabase env vars are valid and the signed-in session is still active.
- Reopen the app or navigate between screens to trigger a refresh/sync cycle.

### Simulator scroll behavior confusion

- Symptom: Add/Edit pitcher forms appear stuck near the keyboard.
- Re-test after dismissing and reopening the keyboard.
- Confirm you are testing the direct mobile form layout on the Add/Edit pitcher screens.
- If needed, drag from within the form body, not the header area.
