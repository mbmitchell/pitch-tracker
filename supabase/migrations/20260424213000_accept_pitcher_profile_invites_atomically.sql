create or replace function public.accept_pitcher_profile_invite_for_user(
  p_token_hash text,
  p_user_id uuid,
  p_normalized_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_invite public.pitcher_profile_invites%rowtype;
  v_existing_pitcher_link public.pitcher_profile_links%rowtype;
  v_existing_user_link public.pitcher_profile_links%rowtype;
  v_created_link public.pitcher_profile_links%rowtype;
begin
  if p_user_id is null then
    return jsonb_build_object('status', 'requires_auth');
  end if;

  if p_token_hash is null or btrim(p_token_hash) = '' then
    return jsonb_build_object('status', 'invalid');
  end if;

  if p_normalized_email is null or btrim(p_normalized_email) = '' then
    return jsonb_build_object('status', 'email_mismatch');
  end if;

  select *
  into v_invite
  from public.pitcher_profile_invites invite
  where invite.token_hash = p_token_hash
  order by invite.created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_invite.status = 'revoked' then
    return jsonb_build_object('status', 'revoked');
  end if;

  if v_invite.status = 'accepted' then
    return jsonb_build_object(
      'status',
      'already_accepted',
      'pitcherProfileId',
      v_invite.pitcher_profile_id
    );
  end if;

  if v_invite.status = 'expired' or v_invite.expires_at < v_now then
    if v_invite.status <> 'expired' then
      update public.pitcher_profile_invites
      set status = 'expired',
          updated_at = v_now
      where id = v_invite.id;
    end if;

    return jsonb_build_object('status', 'expired');
  end if;

  if v_invite.status not in ('pending', 'sent') then
    return jsonb_build_object('status', 'invalid');
  end if;

  if lower(trim(p_normalized_email)) <> v_invite.normalized_email then
    return jsonb_build_object('status', 'email_mismatch');
  end if;

  select *
  into v_existing_pitcher_link
  from public.pitcher_profile_links link
  where link.pitcher_profile_id = v_invite.pitcher_profile_id
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'status',
      'pitcher_already_linked',
      'pitcherProfileId',
      v_invite.pitcher_profile_id
    );
  end if;

  select *
  into v_existing_user_link
  from public.pitcher_profile_links link
  where link.user_id = p_user_id
  limit 1
  for update;

  if found and v_existing_user_link.pitcher_profile_id <> v_invite.pitcher_profile_id then
    return jsonb_build_object(
      'status',
      'user_already_linked',
      'pitcherProfileId',
      v_existing_user_link.pitcher_profile_id
    );
  end if;

  insert into public.pitcher_profile_links (
    pitcher_profile_id,
    user_id,
    created_by_user_id
  )
  values (
    v_invite.pitcher_profile_id,
    p_user_id,
    v_invite.created_by_user_id
  )
  returning *
  into v_created_link;

  update public.pitcher_profile_invites
  set status = 'accepted',
      accepted_by_user_id = p_user_id,
      accepted_at = v_now,
      updated_at = v_now
  where id = v_invite.id;

  return jsonb_build_object(
    'status',
    'accepted',
    'inviteId',
    v_invite.id,
    'linkId',
    v_created_link.id,
    'pitcherProfileId',
    v_invite.pitcher_profile_id
  );
exception
  when unique_violation then
    select *
    into v_existing_pitcher_link
    from public.pitcher_profile_links link
    where link.pitcher_profile_id = v_invite.pitcher_profile_id
    limit 1;

    if found then
      return jsonb_build_object(
        'status',
        'pitcher_already_linked',
        'pitcherProfileId',
        v_invite.pitcher_profile_id
      );
    end if;

    select *
    into v_existing_user_link
    from public.pitcher_profile_links link
    where link.user_id = p_user_id
    limit 1;

    if found and v_existing_user_link.pitcher_profile_id <> v_invite.pitcher_profile_id then
      return jsonb_build_object(
        'status',
        'user_already_linked',
        'pitcherProfileId',
        v_existing_user_link.pitcher_profile_id
      );
    end if;

    return jsonb_build_object('status', 'invalid');
end;
$$;

revoke all on function public.accept_pitcher_profile_invite_for_user(text, uuid, text)
from public, anon, authenticated;

grant execute on function public.accept_pitcher_profile_invite_for_user(text, uuid, text)
to service_role;
