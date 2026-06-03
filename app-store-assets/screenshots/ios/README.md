# PitchReady iOS App Store Screenshot Plan

This folder is the working area for App Store Connect screenshots.

## Target set

Prioritize the iPhone 6.9-inch set first.

Recommended simulator:

- `iPhone 16 Pro Max`

Standardize on portrait PNG output:

- `1320 x 2868 px`

As of June 3, 2026, Apple accepts several 6.9-inch screenshot sizes depending on device family. For PitchReady, use one device size consistently across the full set to avoid mismatched marketing pages.

## Screenshot mode

PitchReady now includes a local-only screenshot mode that is disabled by default.

Environment flags:

- `EXPO_PUBLIC_SCREENSHOT_MODE=1`
- `EXPO_PUBLIC_SCREENSHOT_PROFILE=coach|player|player_setup`

Behavior:

- Seeds deterministic local-only demo data into the offline SQLite cache
- Bypasses live auth and cloud sync
- Does not touch production users or remote Supabase data
- Resets local demo data each time the app starts in screenshot mode

Start helpers:

```bash
npm run ios:screenshots:coach
npm run ios:screenshots:player
npm run ios:screenshots:player-setup
```

## Primary screenshots to capture

Capture these six first:

1. `01-welcome-sign-in`
   Screen: Sign in / welcome
   Mode: normal app mode, not screenshot mode
   Route: `/sign-in`
   Notes: leave fields empty, hide keyboard, keep the screen clean

2. `02-player-setup`
   Screen: Player setup
   Mode: `player_setup`
   Route: auto-opens `/player/onboarding`
   Notes: optionally enter polished sample values before capture:
   First name `Evan`, last name `Brooks`, grade `11`, team `Varsity`, arsenal `4-Seam, Slider, Changeup`

3. `03-workload-dashboard`
   Screen: Staff overview dashboard
   Mode: `coach`
   Route: auto-opens `/dashboard`
   Notes: seeded data shows one ready, one moderate, and one caution pitcher

4. `04-pitcher-profile`
   Screen: Pitcher profile
   Mode: `coach`
   Steps: from dashboard, open `Mason Reed`
   Notes: profile, development, workload summary, and recent history are all seeded for this screen

5. `05-new-throwing-event`
   Screen: New throwing event
   Mode: `coach`
   Steps: from Mason Reed’s profile, tap `Add throwing event`
   Notes: entering from the pitcher profile preselects the pitcher and gives the cleanest screenshot

6. `06-assigned-workout-flow`
   Screen: Player assigned workout flow
   Mode: `player`
   Steps: app opens the player home; tap `Complete assigned workout`
   Route: `/player/log-work?assignedWorkoutId=...`
   Notes: this is the most polished “event history or assigned workout” capture for the current app

Optional seventh screenshot:

7. `07-player-home`
   Screen: Player home with today’s assigned workout card and throwing plan
   Mode: `player`
   Route: `/player`

## Demo data summary

Coach screenshot seed:

- `Mason Reed`: ready-for-bullpen example with profile depth and recent history
- `Noah Kim`: moderate example
- `Leo Carter`: rest/caution example

Player screenshot seed:

- Linked player profile for `Evan Brooks`
- Today’s assigned workout
- Recent throwing history
- One previously completed workout for context

## Capture checklist

Before capturing:

1. Boot `iPhone 16 Pro Max` in Simulator.
2. Use light mode unless marketing direction changes.
3. Hide the software keyboard.
4. Keep status bar clean and avoid notification clutter.
5. Use the same simulator and orientation for the entire 6.9-inch set.

Capture command:

```bash
sh scripts/capture-ios-screenshot.sh 03-workload-dashboard
```

Output path:

```text
app-store-assets/screenshots/ios/6.9-inch/
```

## Manual sequence

Coach set:

1. Run `npm run ios:screenshots:coach`
2. Capture dashboard
3. Open `Mason Reed`
4. Capture pitcher profile
5. Tap `Add throwing event`
6. Capture new throwing event

Player set:

1. Run `npm run ios:screenshots:player`
2. Capture player home if desired
3. Tap `Complete assigned workout`
4. Capture assigned workout flow

Player setup:

1. Run `npm run ios:screenshots:player-setup`
2. Let the app open to player onboarding
3. Optionally enter polished sample text
4. Capture player setup

Welcome screen:

1. Run the app normally without screenshot mode
2. Navigate to `/sign-in`
3. Capture the welcome/sign-in screen
