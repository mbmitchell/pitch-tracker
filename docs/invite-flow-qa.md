# Invite Flow QA

## Manual flow checks

### Coach creates invite for unregistered player
- Sign in as a coach and open an unlinked pitcher profile.
- Create an invite with a new player email address.
- Confirm the pitcher detail screen shows an active invite with:
  - invited email
  - `Pending` or `Sent` status
  - expiration timestamp

### Player signs up from invite
- Open the invite link while signed out.
- Choose `Create account`.
- Complete player sign-up using the invited email.
- Confirm the app returns to invite acceptance after auth.
- Accept the invite.
- Confirm the player lands on `/player`.

### Player signs in from invite
- Open the invite link for an existing player account.
- Choose `Sign in`.
- Sign in with the invited email.
- Confirm the app returns to invite acceptance after auth.
- Accept the invite.
- Confirm the player lands on `/player`.

### Invite acceptance creates link
- After successful acceptance, verify a `pitcher_profile_links` row exists for:
  - `pitcher_profile_id = invited pitcher`
  - `user_id = invited player auth user`
- Confirm the invite row is updated to:
  - `status = accepted`
  - `accepted_by_user_id = player auth user id`
  - `accepted_at` populated

### Player lands on player view
- Reload the app after acceptance.
- Confirm the player account routes to `/player`, not onboarding or auth.

### Coach sees linked and accepted state
- Return to the pitcher detail screen as the coach.
- Confirm the screen shows:
  - `Status: Linked`
  - linked player email when available
  - latest invite status as `Accepted`

### Duplicate invite blocked
- On a pitcher with an active `Pending` or `Sent` invite, attempt to create another invite.
- Confirm the app shows a helpful message telling the coach an active invite already exists.

### Expired invite blocked
- Create an invite, then expire it manually in Supabase or wait for expiry in a test setup.
- Open the link and confirm the player sees `Invite expired`.
- Confirm acceptance does not proceed.

### Revoked invite blocked
- Create an invite, then revoke it from pitcher detail.
- Open the old link and confirm the player sees `Invite revoked`.
- Confirm acceptance does not proceed.

### Wrong email blocked
- Open a valid invite while signed in as a different email than the invited email.
- Confirm the app blocks acceptance and explains the email mismatch.

### Already linked user blocked
- Use a player account already linked to another pitcher.
- Open a different valid invite.
- Confirm the app blocks acceptance with an `already linked` message.

### Already linked pitcher blocked
- Accept an invite or manually link the pitcher first.
- Open an old invite link for that pitcher.
- Confirm the app shows the pitcher is already linked and does not accept again.

## Security checks

- Verify `pitcher_profile_invites` stores `token_hash` only and does not store the raw token.
- Verify invite emails contain the raw token only in the link sent to the player.
- Verify players cannot directly query `public.pitcher_profile_invites` from the client.
- Verify invite acceptance is single-use:
  - accept once
  - retry same link
  - confirm it no longer creates another link
- Verify no service role key is referenced in app client code or exposed through client env vars.

## Troubleshooting

### Edge function env vars missing
- Check the deployed function secrets for:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `INVITE_APP_URL`

### Email provider not configured
- If invite creation succeeds but email is not sent, confirm the provider secrets are present.
- For the current setup, check:
  - `RESEND_API_KEY`
  - `INVITE_EMAIL_FROM`

### Schema cache issues
- If a new migration or RPC is not recognized, refresh Supabase schema cache or redeploy the affected function.
- Re-run local/generated types if needed after schema changes.

### RLS policy failures
- If coach invite reads or writes fail, verify coach-owned RLS on:
  - `pitcher_profiles`
  - `pitcher_profile_invites`
  - `pitcher_profile_links`
- If player acceptance or player reads fail, verify:
  - linked-player read access still works
  - players do not have broad invite-table access
  - acceptance is going through the secure function path, not direct table access
