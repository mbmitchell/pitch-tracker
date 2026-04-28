// @ts-nocheck

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

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

async function hashInviteToken(token: string) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isExpired(expiresAt: string) {
  const parsed = new Date(expiresAt);
  return Number.isNaN(parsed.getTime()) ? false : parsed.getTime() < Date.now();
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

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: authorization
        ? {
            headers: {
              Authorization: authorization,
            },
          }
        : undefined,
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
    } = await anonClient.auth.getUser();

    const body = await request.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return jsonResponse({ status: 'invalid' }, 200);
    }

    const tokenHash = await hashInviteToken(token);
    const { data: invite, error: inviteError } = await serviceClient
      .from('pitcher_profile_invites')
      .select(
        'id, pitcher_profile_id, email, normalized_email, status, expires_at, accepted_by_user_id, accepted_at, created_by_user_id, pitcher_profiles(first_name, last_name)'
      )
      .eq('token_hash', tokenHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteError) {
      throw new Error(inviteError.message);
    }

    if (!invite) {
      return jsonResponse({ status: 'invalid' }, 200);
    }

    if (invite.status === 'revoked') {
      return jsonResponse(
        {
          context: {
            invitedEmail: invite.email,
            pitcherName: `${invite.pitcher_profiles?.first_name ?? ''} ${invite.pitcher_profiles?.last_name ?? ''}`.trim() || null,
          },
          expiresAt: invite.expires_at,
          status: 'revoked',
        },
        200
      );
    }

    if (invite.status === 'accepted') {
      return jsonResponse(
        {
          context: {
            invitedEmail: invite.email,
            pitcherName: `${invite.pitcher_profiles?.first_name ?? ''} ${invite.pitcher_profiles?.last_name ?? ''}`.trim() || null,
          },
          expiresAt: invite.expires_at,
          status: 'already_accepted',
        },
        200
      );
    }

    if (invite.status === 'expired' || isExpired(invite.expires_at)) {
      if (invite.status !== 'expired') {
        await serviceClient
          .from('pitcher_profile_invites')
          .update({ status: 'expired' })
          .eq('id', invite.id);
      }

      return jsonResponse(
        {
          context: {
            invitedEmail: invite.email,
            pitcherName: `${invite.pitcher_profiles?.first_name ?? ''} ${invite.pitcher_profiles?.last_name ?? ''}`.trim() || null,
          },
          expiresAt: invite.expires_at,
          status: 'expired',
        },
        200
      );
    }

    const { data: existingPitcherLink, error: pitcherLinkError } = await serviceClient
      .from('pitcher_profile_links')
      .select('id, user_id')
      .eq('pitcher_profile_id', invite.pitcher_profile_id)
      .maybeSingle();

    if (pitcherLinkError) {
      throw new Error(pitcherLinkError.message);
    }

    if (existingPitcherLink) {
      return jsonResponse(
        {
          context: {
            invitedEmail: invite.email,
            pitcherName: `${invite.pitcher_profiles?.first_name ?? ''} ${invite.pitcher_profiles?.last_name ?? ''}`.trim() || null,
          },
          expiresAt: invite.expires_at,
          status: 'pitcher_already_linked',
        },
        200
      );
    }

    let viewerState = 'requires_auth';

    if (user?.id) {
      const normalizedUserEmail = normalizeEmail(user.email ?? '');

      if (!normalizedUserEmail || normalizedUserEmail !== invite.normalized_email) {
        viewerState = 'email_mismatch';
      } else {
        const { data: userExistingLink, error: userLinkError } = await serviceClient
          .from('pitcher_profile_links')
          .select('pitcher_profile_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (userLinkError) {
          throw new Error(userLinkError.message);
        }

        if (userExistingLink && userExistingLink.pitcher_profile_id !== invite.pitcher_profile_id) {
          viewerState = 'user_already_linked';
        } else {
          viewerState = 'ready_to_accept';
        }
      }
    }

    return jsonResponse(
      {
        context: {
          invitedEmail: invite.email,
          pitcherName:
            `${invite.pitcher_profiles?.first_name ?? ''} ${invite.pitcher_profiles?.last_name ?? ''}`.trim() ||
            null,
        },
        expiresAt: invite.expires_at,
        status: viewerState,
      },
      200
    );
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to validate invite.',
      },
      500
    );
  }
});
