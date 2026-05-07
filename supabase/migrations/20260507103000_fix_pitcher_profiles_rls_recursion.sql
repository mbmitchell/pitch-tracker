create or replace function public.current_user_owns_pitcher_profile(
  p_pitcher_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = p_pitcher_profile_id
      and pitcher.created_by = auth.uid()
  );
$$;

create or replace function public.current_user_is_linked_to_pitcher_profile(
  p_pitcher_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.pitcher_profile_links link
    where link.pitcher_profile_id = p_pitcher_profile_id
      and link.user_id = auth.uid()
  );
$$;

revoke all on function public.current_user_owns_pitcher_profile(uuid)
from public, anon, authenticated;

revoke all on function public.current_user_is_linked_to_pitcher_profile(uuid)
from public, anon, authenticated;

grant execute on function public.current_user_owns_pitcher_profile(uuid)
to authenticated;

grant execute on function public.current_user_is_linked_to_pitcher_profile(uuid)
to authenticated;

drop policy if exists "pitcher_profiles_select_own" on public.pitcher_profiles;

create policy "pitcher_profiles_select_own"
on public.pitcher_profiles
for select
using (
  created_by = auth.uid()
  or public.current_user_is_linked_to_pitcher_profile(id)
);

drop policy if exists "pitcher_profile_links_select_visible" on public.pitcher_profile_links;
drop policy if exists "pitcher_profile_links_insert_owned" on public.pitcher_profile_links;
drop policy if exists "pitcher_profile_links_update_owned" on public.pitcher_profile_links;
drop policy if exists "pitcher_profile_links_delete_owned" on public.pitcher_profile_links;

create policy "pitcher_profile_links_select_visible"
on public.pitcher_profile_links
for select
using (
  user_id = auth.uid()
  or public.current_user_owns_pitcher_profile(pitcher_profile_id)
);

create policy "pitcher_profile_links_insert_owned"
on public.pitcher_profile_links
for insert
with check (
  created_by_user_id = auth.uid()
  and public.current_user_owns_pitcher_profile(pitcher_profile_id)
);

create policy "pitcher_profile_links_update_owned"
on public.pitcher_profile_links
for update
using (
  created_by_user_id = auth.uid()
  and public.current_user_owns_pitcher_profile(pitcher_profile_id)
)
with check (
  created_by_user_id = auth.uid()
  and public.current_user_owns_pitcher_profile(pitcher_profile_id)
);

create policy "pitcher_profile_links_delete_owned"
on public.pitcher_profile_links
for delete
using (
  created_by_user_id = auth.uid()
  and public.current_user_owns_pitcher_profile(pitcher_profile_id)
);
