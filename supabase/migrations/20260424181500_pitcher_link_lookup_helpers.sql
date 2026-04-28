create or replace function public.find_pitcher_link_target_for_owned_pitcher(
  p_pitcher_profile_id uuid,
  p_email text
)
returns table (
  user_id uuid,
  email text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id as user_id,
    u.email
  from auth.users u
  where lower(coalesce(u.email, '')) = lower(trim(coalesce(p_email, '')))
    and exists (
      select 1
      from public.pitcher_profiles pitcher
      where pitcher.id = p_pitcher_profile_id
        and pitcher.created_by = auth.uid()
    )
  limit 1;
$$;

create or replace function public.get_pitcher_profile_link_status_for_owned_pitcher(
  p_pitcher_profile_id uuid
)
returns table (
  link_id uuid,
  pitcher_profile_id uuid,
  user_id uuid,
  email text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    link.id as link_id,
    link.pitcher_profile_id,
    link.user_id,
    u.email,
    link.created_at,
    link.updated_at
  from public.pitcher_profile_links link
  join auth.users u
    on u.id = link.user_id
  where link.pitcher_profile_id = p_pitcher_profile_id
    and exists (
      select 1
      from public.pitcher_profiles pitcher
      where pitcher.id = p_pitcher_profile_id
        and pitcher.created_by = auth.uid()
    )
  limit 1;
$$;

revoke all on function public.find_pitcher_link_target_for_owned_pitcher(uuid, text) from public;
revoke all on function public.get_pitcher_profile_link_status_for_owned_pitcher(uuid) from public;

grant execute on function public.find_pitcher_link_target_for_owned_pitcher(uuid, text) to authenticated;
grant execute on function public.get_pitcher_profile_link_status_for_owned_pitcher(uuid) to authenticated;
