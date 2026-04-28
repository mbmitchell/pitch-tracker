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

function buildPitcherName(pitcher: { first_name?: string | null; last_name?: string | null } | null | undefined) {
  const name = `${pitcher?.first_name ?? ''} ${pitcher?.last_name ?? ''}`.trim();
  return name || null;
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

    const normalizedEmail = normalizeEmail(user.email ?? '');

    if (!normalizedEmail) {
      return jsonResponse({ invites: [] }, 200);
    }

    const now = new Date().toISOString();

    const { error: expireError } = await serviceClient
      .from('pitcher_profile_invites')
      .update({ status: 'expired' })
      .eq('normalized_email', normalizedEmail)
      .in('status', ['pending', 'sent'])
      .lt('expires_at', now);

    if (expireError) {
      throw new Error(expireError.message);
    }

    const { data, error } = await serviceClient
      .from('pitcher_profile_invites')
      .select(
        'id, email, normalized_email, status, expires_at, accepted_at, created_at, pitcher_profile_id, pitcher_profiles(first_name, last_name)'
      )
      .eq('normalized_email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(error.message);
    }

    const invites = (data ?? []).map((invite) => ({
      id: invite.id,
      invitedEmail: invite.email,
      normalizedEmail: invite.normalized_email,
      status: invite.status,
      expiresAt: invite.expires_at,
      acceptedAt: invite.accepted_at,
      createdAt: invite.created_at,
      pitcherProfileId: invite.pitcher_profile_id,
      pitcherName: buildPitcherName(invite.pitcher_profiles),
    }));

    return jsonResponse({ invites }, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unable to load player invites.',
      },
      500
    );
  }
});
