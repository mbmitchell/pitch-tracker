create table if not exists public.pitcher_profile_invites (
  id uuid primary key default gen_random_uuid(),
  pitcher_profile_id uuid not null
    references public.pitcher_profiles (id) on delete cascade,
  email text not null,
  normalized_email text not null,
  created_by_user_id uuid not null
    references auth.users (id) on delete restrict,
  status text not null default 'pending',
  token_hash text not null,
  token_version integer not null default 1,
  expires_at timestamptz not null,
  accepted_by_user_id uuid null
    references auth.users (id) on delete set null,
  accepted_at timestamptz null,
  last_sent_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.pitcher_profile_invites
  drop constraint if exists pitcher_profile_invites_status_check;

alter table if exists public.pitcher_profile_invites
  add constraint pitcher_profile_invites_status_check
  check (status in ('pending', 'sent', 'accepted', 'expired', 'revoked'));

create index if not exists pitcher_profile_invites_pitcher_profile_id_idx
  on public.pitcher_profile_invites (pitcher_profile_id);

create index if not exists pitcher_profile_invites_normalized_email_idx
  on public.pitcher_profile_invites (normalized_email);

create index if not exists pitcher_profile_invites_status_idx
  on public.pitcher_profile_invites (status);

create unique index if not exists pitcher_profile_invites_active_pitcher_email_key
  on public.pitcher_profile_invites (pitcher_profile_id, normalized_email)
  where status in ('pending', 'sent');

create unique index if not exists pitcher_profile_invites_active_pitcher_key
  on public.pitcher_profile_invites (pitcher_profile_id)
  where status in ('pending', 'sent');

drop trigger if exists set_pitcher_profile_invites_updated_at on public.pitcher_profile_invites;

create trigger set_pitcher_profile_invites_updated_at
before update on public.pitcher_profile_invites
for each row
execute function public.set_updated_at();

alter table public.pitcher_profile_invites enable row level security;

drop policy if exists "pitcher_profile_invites_select_owned" on public.pitcher_profile_invites;
drop policy if exists "pitcher_profile_invites_insert_owned" on public.pitcher_profile_invites;
drop policy if exists "pitcher_profile_invites_update_owned" on public.pitcher_profile_invites;
drop policy if exists "pitcher_profile_invites_delete_owned" on public.pitcher_profile_invites;

create policy "pitcher_profile_invites_select_owned"
on public.pitcher_profile_invites
for select
using (
  exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = pitcher_profile_invites.pitcher_profile_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "pitcher_profile_invites_insert_owned"
on public.pitcher_profile_invites
for insert
with check (
  created_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = pitcher_profile_invites.pitcher_profile_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "pitcher_profile_invites_update_owned"
on public.pitcher_profile_invites
for update
using (
  created_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = pitcher_profile_invites.pitcher_profile_id
      and pitcher.created_by = auth.uid()
  )
)
with check (
  created_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = pitcher_profile_invites.pitcher_profile_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "pitcher_profile_invites_delete_owned"
on public.pitcher_profile_invites
for delete
using (
  created_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = pitcher_profile_invites.pitcher_profile_id
      and pitcher.created_by = auth.uid()
  )
);
