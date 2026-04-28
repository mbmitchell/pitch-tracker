drop policy if exists "throwing_events_insert_own" on public.throwing_events;
drop policy if exists "event_pitch_breakdown_insert_own" on public.event_pitch_breakdown;

create policy "throwing_events_insert_own"
on public.throwing_events
for insert
with check (
  (
    entered_by_user_id = auth.uid()
    and exists (
      select 1
      from public.pitcher_profiles pitcher
      where pitcher.id = throwing_events.pitcher_id
        and pitcher.created_by = auth.uid()
    )
  )
  or (
    entered_by_user_id = auth.uid()
    and source_type = 'pitcher'
    and exists (
      select 1
      from public.pitcher_profile_links link
      where link.pitcher_profile_id = throwing_events.pitcher_id
        and link.user_id = auth.uid()
    )
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
  or exists (
    select 1
    from public.throwing_events event
    join public.pitcher_profile_links link
      on link.pitcher_profile_id = event.pitcher_id
    where event.id = event_pitch_breakdown.event_id
      and event.entered_by_user_id = auth.uid()
      and link.user_id = auth.uid()
  )
);
