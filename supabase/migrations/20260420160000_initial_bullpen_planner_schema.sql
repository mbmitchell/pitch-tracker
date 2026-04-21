create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.pitcher_profiles (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete restrict,
  first_name text not null,
  last_name text not null,
  age integer,
  grade text,
  level_team text,
  handedness text not null,
  pitch_arsenal text[] not null default '{}',
  development_phase text not null,
  primary_goals text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pitcher_profiles_age_check
    check (age is null or age between 5 and 30),
  constraint pitcher_profiles_handedness_check
    check (handedness in ('RHP', 'LHP', 'SWITCH')),
  constraint pitcher_profiles_development_phase_check
    check (
      development_phase in (
        'assessment',
        'build',
        'preseason',
        'in_season',
        'recovery',
        'offseason'
      )
    )
);

create index pitcher_profiles_created_by_idx
  on public.pitcher_profiles (created_by);

create trigger set_pitcher_profiles_updated_at
before update on public.pitcher_profiles
for each row
execute function public.set_updated_at();

create table public.throwing_events (
  id uuid primary key default gen_random_uuid(),
  pitcher_id uuid not null references public.pitcher_profiles (id) on delete cascade,
  date date not null,
  event_type text not null,
  total_pitches integer,
  innings_thrown numeric(4,1),
  intensity text not null,
  arm_feel text not null,
  bullpen_focus text,
  notes text,
  entered_by_user_id uuid not null references auth.users (id) on delete restrict,
  source_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint throwing_events_total_pitches_check
    check (total_pitches is null or total_pitches >= 0),
  constraint throwing_events_innings_thrown_check
    check (innings_thrown is null or innings_thrown >= 0),
  constraint throwing_events_event_type_check
    check (
      event_type in (
        'bullpen',
        'game',
        'live_ab',
        'practice',
        'long_toss',
        'recovery',
        'assessment',
        'other'
      )
    ),
  constraint throwing_events_intensity_check
    check (intensity in ('low', 'medium', 'high', 'max')),
  constraint throwing_events_arm_feel_check
    check (arm_feel in ('great', 'good', 'neutral', 'sore', 'pain')),
  constraint throwing_events_bullpen_focus_check
    check (
      bullpen_focus is null
      or bullpen_focus in (
        'command',
        'velocity',
        'mechanics',
        'secondary_pitches',
        'recovery',
        'live_execution',
        'other'
      )
    ),
  constraint throwing_events_source_type_check
    check (
      source_type in (
        'coach_entry',
        'pitcher_entry',
        'import',
        'system'
      )
    )
);

create index throwing_events_pitcher_id_date_idx
  on public.throwing_events (pitcher_id, date desc);

create index throwing_events_entered_by_user_id_idx
  on public.throwing_events (entered_by_user_id);

create trigger set_throwing_events_updated_at
before update on public.throwing_events
for each row
execute function public.set_updated_at();

create table public.event_pitch_breakdown (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.throwing_events (id) on delete cascade,
  pitch_type text not null,
  pitch_count integer not null,
  constraint event_pitch_breakdown_pitch_count_check
    check (pitch_count >= 0),
  constraint event_pitch_breakdown_event_pitch_type_key
    unique (event_id, pitch_type)
);

create index event_pitch_breakdown_event_id_idx
  on public.event_pitch_breakdown (event_id);

comment on table public.pitcher_profiles is
  'Separate from auth.users so coaches can manage pitchers now and player-linked accounts can be added later without reshaping core profile data.';

comment on table public.throwing_events is
  'Core workload entity for every throwing workload, including future game outings and granular tracking beyond bullpens.';

comment on column public.throwing_events.source_type is
  'Tracks how the event entered the system so future pitcher login, imports, and automated ingestion remain distinguishable.';

comment on table public.event_pitch_breakdown is
  'Per-event aggregate pitch mix. Future outing pitch tracking can add a child table for pitch-by-pitch or inning-level details without replacing this table.';
