update public.throwing_events
set source_type = 'player'
where source_type = 'pitcher';

alter table public.throwing_events
  drop constraint if exists throwing_events_source_type_check;

alter table public.throwing_events
  add constraint throwing_events_source_type_check
  check (
    source_type in (
      'coach',
      'player',
      'import',
      'system'
    )
  );

drop policy if exists "throwing_events_insert_own" on public.throwing_events;

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
    and source_type = 'player'
    and exists (
      select 1
      from public.pitcher_profile_links link
      where link.pitcher_profile_id = throwing_events.pitcher_id
        and link.user_id = auth.uid()
    )
  )
);
