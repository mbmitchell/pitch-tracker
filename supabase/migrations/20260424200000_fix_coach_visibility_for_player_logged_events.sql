drop policy if exists "throwing_events_select_own" on public.throwing_events;
drop policy if exists "event_pitch_breakdown_select_own" on public.event_pitch_breakdown;

create policy "throwing_events_select_own"
on public.throwing_events
for select
using (
  exists (
    select 1
    from public.pitcher_profiles pitcher
    where pitcher.id = throwing_events.pitcher_id
      and pitcher.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.pitcher_profile_links link
    where link.pitcher_profile_id = throwing_events.pitcher_id
      and link.user_id = auth.uid()
  )
);

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
