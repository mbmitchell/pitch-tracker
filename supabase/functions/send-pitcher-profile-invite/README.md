# `send-pitcher-profile-invite`

Server-side Bullpen Planner function for secure pitcher invite creation.

## Required secrets

Set these in Supabase Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INVITE_APP_URL`

## Optional email secrets

To send real emails through Resend:

- `RESEND_API_KEY`
- `INVITE_EMAIL_FROM`

If the email secrets are missing, the function still creates or refreshes the invite row and returns a safe dev-mode message instead of sending email.

## Deploy

```bash
supabase functions deploy send-pitcher-profile-invite
```

## Client expectation

The client calls this function from `createPitcherProfileInviteForCoach(...)`.
The function returns:

- `invite`
- `was_created`
- `delivery.mode`
- `delivery.message`

It never returns the raw invite token and never stores the raw token in the database.
