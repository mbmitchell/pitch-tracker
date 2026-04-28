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

function errorResponse(error: string, message: string, status: number) {
  return jsonResponse({ error, message }, status);
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

Deno.serve(async (request) => {
  console.log('[accept-player-pitcher-invite] invoked', {
    method: request.method,
    hasAuthorization: Boolean(request.headers.get('Authorization')),
  });

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    console.log('[accept-player-pitcher-invite] method_not_allowed');
    return errorResponse('method_not_allowed', 'Method not allowed.', 405);
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');

    if (!authorization) {
      console.log('[accept-player-pitcher-invite] missing_authorization');
      return errorResponse(
        'missing_authorization',
        'Missing authorization header.',
        401
      );
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
      console.log('[accept-player-pitcher-invite] auth_failed', {
        hasUser: Boolean(user),
        hasUserError: Boolean(userError),
      });
      return errorResponse('auth_failed', 'Unauthorized.', 401);
    }

    const body = await request.json().catch(() => null);
    const inviteId = typeof body?.inviteId === 'string' ? body.inviteId.trim() : '';
    console.log('[accept-player-pitcher-invite] parsed_request', {
      hasInviteId: Boolean(inviteId),
    });

    if (!inviteId) {
      console.log('[accept-player-pitcher-invite] missing_invite_id');
      return errorResponse(
        'missing_invite_id',
        'Invite id is required to continue.',
        400
      );
    }

    const normalizedEmail = normalizeEmail(user.email ?? '');

    if (!normalizedEmail) {
      console.log('[accept-player-pitcher-invite] email_mismatch_missing_email');
      return jsonResponse({ status: 'email_mismatch' }, 200);
    }

    const { data, error } = await serviceClient.rpc(
      'accept_pitcher_profile_invite_for_user_by_id',
      {
        p_invite_id: inviteId,
        p_user_id: user.id,
        p_normalized_email: normalizedEmail,
      }
    );

    if (error) {
      console.log('[accept-player-pitcher-invite] rpc_error', {
        code: error.code ?? null,
      });
      throw new Error(error.message);
    }

    const result = data ?? { status: 'invalid' };
    const status = typeof result?.status === 'string' ? result.status : 'invalid';

    switch (status) {
      case 'invalid':
        console.log('[accept-player-pitcher-invite] invite_not_found_or_invalid');
        return jsonResponse({ status }, 200);
      case 'expired':
        console.log('[accept-player-pitcher-invite] invite_expired');
        return jsonResponse({ status }, 200);
      case 'revoked':
        console.log('[accept-player-pitcher-invite] invite_revoked');
        return jsonResponse({ status }, 200);
      case 'email_mismatch':
        console.log('[accept-player-pitcher-invite] email_mismatch');
        return jsonResponse({ status }, 200);
      case 'pitcher_already_linked':
        console.log('[accept-player-pitcher-invite] pitcher_already_linked');
        return jsonResponse({ status, pitcherProfileId: result.pitcherProfileId ?? null }, 200);
      case 'user_already_linked':
        console.log('[accept-player-pitcher-invite] user_already_linked');
        return jsonResponse({ status, pitcherProfileId: result.pitcherProfileId ?? null }, 200);
      case 'already_accepted':
        console.log('[accept-player-pitcher-invite] invite_already_accepted');
        return jsonResponse({ status, pitcherProfileId: result.pitcherProfileId ?? null }, 200);
      case 'accepted':
        console.log('[accept-player-pitcher-invite] success', {
          pitcherProfileId: result.pitcherProfileId ?? null,
        });
        return jsonResponse(
          {
            success: true,
            pitcherProfileId: result.pitcherProfileId ?? null,
          },
          200
        );
      default:
        console.log('[accept-player-pitcher-invite] unexpected_status', { status });
        return jsonResponse({ status }, 200);
    }
  } catch (error) {
    console.log('[accept-player-pitcher-invite] unhandled_error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return errorResponse(
      'accept_invite_failed',
      error instanceof Error ? error.message : 'Unable to accept invite.',
      500
    );
  }
});
