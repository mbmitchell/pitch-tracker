# Bullpen Planner

Expo Router + React Native + TypeScript starter for a bullpen planning mobile app.

## Run locally

```bash
npm install
npx expo start
```

## Environment variables

Create a `.env` file in the project root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Starter structure

- `app/` contains Expo Router routes
- `src/features/` contains feature-level screens
- `src/lib/supabase.ts` sets up the Supabase client
- `src/services/` contains placeholder app services and mock data
