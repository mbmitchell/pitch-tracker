alter table public.pitcher_profiles enable row level security;
alter table public.throwing_events enable row level security;
alter table public.event_pitch_breakdown enable row level security;

drop policy if exists "pitcher_profiles_select_own" on public.pitcher_profiles;
drop policy if exists "pitcher_profiles_insert_own" on public.pitcher_profiles;
drop policy if exists "pitcher_profiles_update_own" on public.pitcher_profiles;
drop policy if exists "pitcher_profiles_delete_own" on public.pitcher_profiles;

create policy "pitcher_profiles_select_own"
on public.pitcher_profiles
for select
using (created_by = auth.uid());

create policy "pitcher_profiles_insert_own"
on public.pitcher_profiles
for insert
with check (created_by = auth.uid());

create policy "pitcher_profiles_update_own"
on public.pitcher_profiles
for update
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "pitcher_profiles_delete_own"
on public.pitcher_profiles
for delete
using (created_by = auth.uid());

drop policy if exists "throwing_events_select_own" on public.throwing_events;
drop policy if exists "throwing_events_insert_own" on public.throwing_events;
drop policy if exists "throwing_events_update_own" on public.throwing_events;
drop policy if exists "throwing_events_delete_own" on public.throwing_events;

create policy "throwing_events_select_own"
on public.throwing_events
for select
using (
  entered_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = throwing_events.pitcher_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "throwing_events_insert_own"
on public.throwing_events
for insert
with check (
  entered_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = throwing_events.pitcher_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "throwing_events_update_own"
on public.throwing_events
for update
using (
  entered_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = throwing_events.pitcher_id
      and pitcher.created_by = auth.uid()
  )
)
with check (
  entered_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = throwing_events.pitcher_id
      and pitcher.created_by = auth.uid()
  )
);

create policy "throwing_events_delete_own"
on public.throwing_events
for delete
using (
  entered_by_user_id = auth.uid()
  and exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = throwing_events.pitcher_id
      and pitcher.created_by = auth.uid()
  )
);

drop policy if exists "event_pitch_breakdown_select_own" on public.event_pitch_breakdown;
drop policy if exists "event_pitch_breakdown_insert_own" on public.event_pitch_breakdown;
drop policy if exists "event_pitch_breakdown_update_own" on public.event_pitch_breakdown;
drop policy if exists "event_pitch_breakdown_delete_own" on public.event_pitch_breakdown;

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
);

create policy "event_pitch_breakdown_insert_own"
on public.event_pitch_breakdown
for insert
with check (
  exists (
    select 1
    from public.throwing_events event
    join public.pitcher_profiles pitcher
      on pitcher.id = event.pitcher_id
    where event.id = event_pitch_breakdown.event_id
      and event.entered_by_user_id = auth.uid()
      and pitcher.created_by = auth.uid()
  )
);

create policy "event_pitch_breakdown_update_own"
on public.event_pitch_breakdown
for update
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
)
with check (
  exists (
    select 1
    from public.throwing_events event
    join public.pitcher_profiles pitcher
      on pitcher.id = event.pitcher_id
    where event.id = event_pitch_breakdown.event_id
      and event.entered_by_user_id = auth.uid()
      and pitcher.created_by = auth.uid()
  )
);

create policy "event_pitch_breakdown_delete_own"
on public.event_pitch_breakdown
for delete
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
);
