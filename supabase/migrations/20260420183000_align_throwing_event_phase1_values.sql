update public.throwing_events
set event_type = case event_type
  when 'game' then 'game_outing'
  when 'practice' then 'flat_ground'
  when 'recovery' then 'recovery_throw'
  when 'assessment' then 'other'
  else event_type
end;

update public.throwing_events
set source_type = case source_type
  when 'coach_entry' then 'coach'
  when 'pitcher_entry' then 'pitcher'
  else source_type
end;

alter table public.throwing_events
  alter column source_type set default 'coach';

alter table public.throwing_events
  drop constraint if exists throwing_events_event_type_check;

alter table public.throwing_events
  add constraint throwing_events_event_type_check
    check (
      event_type in (
        'bullpen',
        'game_outing',
        'live_ab',
        'flat_ground',
        'long_toss',
        'recovery_throw',
        'other'
      )
    );

alter table public.throwing_events
  drop constraint if exists throwing_events_source_type_check;

alter table public.throwing_events
  add constraint throwing_events_source_type_check
    check (
      source_type in (
        'coach',
        'pitcher',
        'import',
        'system'
      )
    );
