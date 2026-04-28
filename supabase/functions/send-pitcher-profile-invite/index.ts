// @ts-nocheck

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { sendPitcherInviteEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const INVITE_EXPIRATION_DAYS = 14;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function buildInviteExpirationDate() {
  return new Date(Date.now() + INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function generateOpaqueInviteToken() {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

async function hashInviteToken(token: string) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function buildInviteLink(token: string) {
  const appUrl = Deno.env.get('INVITE_APP_URL') ?? 'https://example.com';
  return `${appUrl.replace(/\/$/, '')}/invite/accept?token=${encodeURIComponent(token)}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');

    if (!authorization) {
      return jsonResponse({ error: 'Missing authorization header.' }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized.' }, 401);
    }

    const body = await request.json().catch(() => null);
    const pitcherProfileId = body?.pitcherProfileId;
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!pitcherProfileId || !email) {
      return jsonResponse(
        { error: 'pitcherProfileId and email are required.' },
        400
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const {
      data: pitcher,
      error: pitcherError,
    } = await serviceClient
      .from('pitcher_profiles')
      .select('id, created_by, first_name, last_name')
      .eq('id', pitcherProfileId)
      .eq('created_by', user.id)
      .maybeSingle();

    if (pitcherError) {
      throw new Error(pitcherError.message);
    }

    if (!pitcher) {
      return jsonResponse({ error: 'Pitcher profile not found for this coach.' }, 403);
    }

    const {
      data: existingLink,
      error: linkError,
    } = await serviceClient
      .from('pitcher_profile_links')
      .select('id')
      .eq('pitcher_profile_id', pitcherProfileId)
      .maybeSingle();

    if (linkError) {
      throw new Error(linkError.message);
    }

    if (existingLink) {
      return jsonResponse(
        { error: 'This pitcher is already linked to a player account.' },
        409
      );
    }

    const now = new Date().toISOString();
    const expiresAt = buildInviteExpirationDate();
    const rawToken = generateOpaqueInviteToken();
    const tokenHash = await hashInviteToken(rawToken);

    const { error: expireError } = await serviceClient
      .from('pitcher_profile_invites')
      .update({
        status: 'expired',
      })
      .eq('pitcher_profile_id', pitcherProfileId)
      .in('status', ['pending', 'sent'])
      .lt('expires_at', now);

    if (expireError) {
      throw new Error(expireError.message);
    }

    const {
      data: activeInvite,
      error: activeInviteError,
    } = await serviceClient
      .from('pitcher_profile_invites')
      .select('*')
      .eq('pitcher_profile_id', pitcherProfileId)
      .in('status', ['pending', 'sent'])
      .gte('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeInviteError) {
      throw new Error(activeInviteError.message);
    }

    let invite;
    let wasCreated = false;

    if (activeInvite) {
      const { data: updatedInvite, error: updateError } = await serviceClient
        .from('pitcher_profile_invites')
        .update({
          accepted_at: null,
          accepted_by_user_id: null,
          email: email.trim(),
          expires_at: expiresAt,
          last_sent_at: now,
          normalized_email: normalizedEmail,
          status: 'sent',
          token_hash: tokenHash,
          token_version: (activeInvite.token_version ?? 1) + 1,
        })
        .eq('id', activeInvite.id)
        .select('*')
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      invite = updatedInvite;
    } else {
      const { data: insertedInvite, error: insertError } = await serviceClient
        .from('pitcher_profile_invites')
        .insert({
          created_by_user_id: user.id,
          email: email.trim(),
          expires_at: expiresAt,
          last_sent_at: now,
          normalized_email: normalizedEmail,
          pitcher_profile_id: pitcherProfileId,
          status: 'sent',
          token_hash: tokenHash,
          token_version: 1,
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      invite = insertedInvite;
      wasCreated = true;
    }

    try {
      const delivery = await sendPitcherInviteEmail({
        coachName:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email ??
          null,
        expiresAt,
        inviteLink: buildInviteLink(rawToken),
        pitcherName: `${pitcher.first_name} ${pitcher.last_name}`.trim(),
        to: email.trim(),
      });

      return jsonResponse({
        delivery,
        invite,
        was_created: wasCreated,
      });
    } catch (deliveryError) {
      await serviceClient
        .from('pitcher_profile_invites')
        .update({
          last_sent_at: null,
          status: 'pending',
        })
        .eq('id', invite.id);

      throw deliveryError;
    }
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Unable to create and send invite.',
      },
      500
    );
  }
});
