create table if not exists public.assigned_workouts (
  id uuid primary key default gen_random_uuid(),
  pitcher_id uuid not null
    references public.pitcher_profiles (id) on delete cascade,
  assigned_by_user_id uuid not null
    references auth.users (id) on delete restrict,
  planned_date date not null,
  title text not null,
  focus text not null,
  target_pitch_count integer not null,
  intensity text not null,
  pitch_mix jsonb not null default '[]'::jsonb,
  work_blocks jsonb not null default '[]'::jsonb,
  coach_notes text null,
  status text not null default 'assigned',
  viewed_at timestamptz null,
  completed_at timestamptz null,
  pitcher_feedback text null,
  completed_throwing_event_id uuid null
    references public.throwing_events (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.assigned_workouts
  drop constraint if exists assigned_workouts_status_check;

alter table if exists public.assigned_workouts
  add constraint assigned_workouts_status_check
  check (status in ('assigned', 'viewed', 'completed', 'skipped', 'canceled'));

alter table if exists public.assigned_workouts
  drop constraint if exists assigned_workouts_intensity_check;

alter table if exists public.assigned_workouts
  add constraint assigned_workouts_intensity_check
  check (intensity in ('low', 'medium', 'high', 'max'));

alter table if exists public.assigned_workouts
  drop constraint if exists assigned_workouts_target_pitch_count_check;

alter table if exists public.assigned_workouts
  add constraint assigned_workouts_target_pitch_count_check
  check (target_pitch_count >= 0);

create index if not exists assigned_workouts_pitcher_id_idx
  on public.assigned_workouts (pitcher_id);

create index if not exists assigned_workouts_assigned_by_user_id_idx
  on public.assigned_workouts (assigned_by_user_id);

create index if not exists assigned_workouts_planned_date_idx
  on public.assigned_workouts (planned_date);

create index if not exists assigned_workouts_status_idx
  on public.assigned_workouts (status);

drop trigger if exists set_assigned_workouts_updated_at on public.assigned_workouts;

create trigger set_assigned_workouts_updated_at
before update on public.assigned_workouts
for each row
execute function public.set_updated_at();

alter table public.assigned_workouts enable row level security;

drop policy if exists "assigned_workouts_select_visible" on public.assigned_workouts;
drop policy if exists "assigned_workouts_insert_owned" on public.assigned_workouts;
drop policy if exists "assigned_workouts_update_owned" on public.assigned_workouts;
drop policy if exists "assigned_workouts_delete_owned" on public.assigned_workouts;
drop policy if exists "assigned_workouts_update_player_completion" on public.assigned_workouts;

create policy "assigned_workouts_select_visible"
on public.assigned_workouts
for select
using (
  exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = assigned_workouts.pitcher_id
      and pitcher.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.pitcher_profile_links link
    where link.pitcher_profile_id = assigned_workouts.pitcher_id
      and link.user_id = auth.uid()
  )
);

create policy "assigned_workouts_insert_owned"
on public.assigned_workouts
for insert
with check (
  assigned_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = assigned_workouts.pitcher_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "assigned_workouts_update_owned"
on public.assigned_workouts
for update
using (
  assigned_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = assigned_workouts.pitcher_id
      and pitcher.created_by = auth.uid()
  )
)
with check (
  assigned_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = assigned_workouts.pitcher_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "assigned_workouts_delete_owned"
on public.assigned_workouts
for delete
using (
  assigned_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = assigned_workouts.pitcher_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "assigned_workouts_update_player_completion"
on public.assigned_workouts
for update
using (
  exists (
    select 1
    from public.pitcher_profile_links link
    where link.pitcher_profile_id = assigned_workouts.pitcher_id
      and link.user_id = auth.uid()
  )
)
with check (
  status in ('viewed', 'completed', 'skipped')
  and exists (
    select 1
    from public.pitcher_profile_links link
    where link.pitcher_profile_id = assigned_workouts.pitcher_id
      and link.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.assigned_workouts current
    where current.id = assigned_workouts.id
      and current.pitcher_id = assigned_workouts.pitcher_id
      and current.assigned_by_user_id = assigned_workouts.assigned_by_user_id
      and current.planned_date = assigned_workouts.planned_date
      and current.title = assigned_workouts.title
      and current.focus = assigned_workouts.focus
      and current.target_pitch_count = assigned_workouts.target_pitch_count
      and current.intensity = assigned_workouts.intensity
      and current.pitch_mix = assigned_workouts.pitch_mix
      and current.work_blocks = assigned_workouts.work_blocks
      and coalesce(current.coach_notes, '') = coalesce(assigned_workouts.coach_notes, '')
      and current.created_at = assigned_workouts.created_at
  )
  and (
    assigned_workouts.completed_throwing_event_id is null
    or exists (
      select 1
      from public.throwing_events event
      where event.id = assigned_workouts.completed_throwing_event_id
        and event.entered_by_user_id = auth.uid()
        and event.pitcher_id = assigned_workouts.pitcher_id
    )
  )
);
