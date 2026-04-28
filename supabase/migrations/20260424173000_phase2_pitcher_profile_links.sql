create table if not exists public.pitcher_profile_links (
  id uuid primary key default gen_random_uuid(),
  pitcher_profile_id uuid not null unique
    references public.pitcher_profiles (id) on delete cascade,
  user_id uuid not null unique
    references auth.users (id) on delete cascade,
  created_by_user_id uuid not null
    references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists pitcher_profile_links_user_id_idx
  on public.pitcher_profile_links (user_id);

create index if not exists pitcher_profile_links_created_by_user_id_idx
  on public.pitcher_profile_links (created_by_user_id);

drop trigger if exists set_pitcher_profile_links_updated_at on public.pitcher_profile_links;

create trigger set_pitcher_profile_links_updated_at
before update on public.pitcher_profile_links
for each row
execute function public.set_updated_at();

alter table public.pitcher_profile_links enable row level security;

drop policy if exists "pitcher_profile_links_select_visible" on public.pitcher_profile_links;
drop policy if exists "pitcher_profile_links_insert_owned" on public.pitcher_profile_links;
drop policy if exists "pitcher_profile_links_update_owned" on public.pitcher_profile_links;
drop policy if exists "pitcher_profile_links_delete_owned" on public.pitcher_profile_links;

create policy "pitcher_profile_links_select_visible"
on public.pitcher_profile_links
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = pitcher_profile_links.pitcher_profile_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "pitcher_profile_links_insert_owned"
on public.pitcher_profile_links
for insert
with check (
  created_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = pitcher_profile_links.pitcher_profile_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "pitcher_profile_links_update_owned"
on public.pitcher_profile_links
for update
using (
  created_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = pitcher_profile_links.pitcher_profile_id
      and pitcher.created_by = auth.uid()
  )
)
with check (
  created_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = pitcher_profile_links.pitcher_profile_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "pitcher_profile_links_delete_owned"
on public.pitcher_profile_links
for delete
using (
  created_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = pitcher_profile_links.pitcher_profile_id
      and pitcher.created_by = auth.uid()
  )
);

drop policy if exists "pitcher_profiles_select_own" on public.pitcher_profiles;

create policy "pitcher_profiles_select_own"
on public.pitcher_profiles
for select
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.pitcher_profile_links link
    where link.pitcher_profile_id = pitcher_profiles.id
      and link.user_id = auth.uid()
  )
);

drop policy if exists "throwing_events_select_own" on public.throwing_events;

create policy "throwing_events_select_own"
on public.throwing_events
for select
using (
  (
    entered_by_user_id = auth.uid()
    and exists (
      select 1
      from public.pitcher_profiles pitcher
      where pitcher.id = throwing_events.pitcher_id
        and pitcher.created_by = auth.uid()
    )
  )
  or exists (
    select 1
    from public.pitcher_profile_links link
    where link.pitcher_profile_id = throwing_events.pitcher_id
      and link.user_id = auth.uid()
  )
);

drop policy if exists "event_pitch_breakdown_select_own" on public.event_pitch_breakdown;

create policy "event_pitch_breakdown_select_own"
on public.event_pitch_breakdown
for select
using (
  exists (
    select 1
    from public.throwing_events event
    join public.pitcher_profiles pitcher
      on pitcher.id = event.pitcher_id
    where event.id = event_pitch_breakdown.event_id
      and event.entered_by_user_id = auth.uid()
      and pitcher.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.throwing_events event
    join public.pitcher_profile_links link
      on link.pitcher_profile_id = event.pitcher_id
    where event.id = event_pitch_breakdown.event_id
      and link.user_id = auth.uid()
  )
);
