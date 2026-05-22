# PitchReady

PitchReady is an Expo Router + React Native + TypeScript app for pitcher workload tracking,
bullpen planning, recovery, readiness, and throwing-event logging.

## Run locally

```bash
npm install
npm run web
```

For mobile development, use:

```bash
npx expo start
```

## Environment variables

Create a `.env` file in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Public website

The repo now includes a lightweight public website for App Store submission support with:

- `/` landing page
- `/privacy` privacy policy
- `/terms` terms of service
- `/support` support page

The public site uses Expo Router's existing web/static export support and does not connect to
Supabase.

## Deploying the website

Build the static website export:

```bash
npm run export:web
```

Expo writes the static output to `dist/`. You can deploy that folder to Vercel, Netlify, or any
static host.

Suggested settings:

- Vercel: framework preset `Other`, build command `npm run export:web`, output directory `dist`
- Netlify: build command `npm run export:web`, publish directory `dist`

## App environment variables

Create a `.env` file in the project root for app functionality:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The public website can render without these values, but app authentication and live data require
them.

## Project structure

- `app/` contains Expo Router routes
- `src/features/` contains feature-level screens
- `src/lib/supabase.ts` sets up the Supabase client
- `src/services/` contains placeholder app services and mock data
