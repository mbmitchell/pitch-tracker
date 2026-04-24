# Offline QA Checklist

## Manual checks

### 1. First online load caches data
- Sign in with a coach account that already has pitchers and throwing events.
- Open the dashboard, pitcher list, one pitcher detail screen, and one recommendation screen.
- Confirm the screens load normally while online.
- Confirm the sync status pill does not stay on `Offline`.

### 2. Offline dashboard uses cached data
- After the first online load, disable network access on the simulator/device.
- Reopen the dashboard.
- Confirm the dashboard still loads cached pitchers and readiness/status cards.
- Open the pitcher list and confirm cached roster data still appears.

### 3. Create pitcher offline
- Stay offline.
- Create a new pitcher.
- Confirm the pitcher appears immediately in the pitcher list and detail flow.
- Confirm the sync status shows pending work, such as `1 change pending`.

### 4. Create throwing event offline
- Stay offline.
- Open a pitcher and create a throwing event.
- Add pitch breakdown rows if desired.
- Confirm the event appears immediately in pitcher history and related recommendation/history views.
- Confirm the pending count increases.

### 5. Restore network and confirm sync succeeds
- Re-enable network access.
- Wait for reconnect-triggered sync to run.
- Confirm the sync status changes through `Syncing` and eventually clears to `All changes synced`.

### 6. Verify records appear in Supabase
- In Supabase, confirm the offline-created pitcher appears in `pitcher_profiles`.
- Confirm the offline-created event appears in `throwing_events`.
- Confirm pitch breakdown rows appear in `event_pitch_breakdown` when entered.

### 7. Verify pending count clears
- After sync completes, confirm the status pill no longer shows pending changes.
- Confirm previously pending records still appear in the app after refresh/navigation.

### 8. Verify failed sync state is visible
- Create a scenario where sync should fail, such as using a coach account blocked by RLS or invalid payload data.
- Reconnect network.
- Confirm the app surfaces a useful failed status, such as a sync issue count.
- Confirm the item remains in the queue instead of disappearing silently.

### 9. Verify restart while offline still uses cache
- Load data online first.
- Turn off network.
- Fully restart the app while still offline.
- Confirm the dashboard, pitcher list, and previously viewed pitcher detail/history still load from local cache.

## Troubleshooting

### Missing SQLite initialization
- Confirm the offline database initialization path runs before local cache reads/writes.
- If local tables are missing, clear the app data and relaunch after confirming schema initialization is still called.

### NetInfo not detecting simulator changes
- Toggle airplane mode or fully disable host network access instead of relying on weak simulator state changes.
- If status seems stale, background/foreground the app or restart the simulator session.

### Supabase RLS blocking sync
- Confirm `created_by` on `pitcher_profiles` matches the signed-in coach user id.
- Confirm `entered_by_user_id` on `throwing_events` matches the signed-in coach user id.
- Check Supabase logs for rejected inserts/updates when queue items move to failed state.

### Parent-child sync ordering issues
- Confirm pitcher create items sync before events that reference that pitcher.
- Confirm event create items sync before pitch breakdown rows for that event.
- If child rows fail repeatedly, inspect queue order and stored payload ids for the related parent record.
