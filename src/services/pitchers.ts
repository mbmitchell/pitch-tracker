import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  DevelopmentPhase,
  Handedness,
  PitcherProfile,
  PitcherProfileInsert,
  PitcherProfileUpdate,
} from '@/types/models';

export type PitcherProfileInput = {
  first_name: string;
  last_name: string;
  age: number | null;
  grade: string | null;
  level_team: string | null;
  handedness: Handedness;
  pitch_arsenal: string[];
  development_phase: DevelopmentPhase;
  primary_goals: string | null;
  notes: string | null;
};

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to continue.'
    );
  }
}

const supabaseClient = supabase as any;

function normalizePitcherInput(input: PitcherProfileInput): PitcherProfileInput {
  return {
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    age: input.age,
    grade: input.grade?.trim() ? input.grade.trim() : null,
    level_team: input.level_team?.trim() ? input.level_team.trim() : null,
    handedness: input.handedness,
    pitch_arsenal: Array.from(
      new Set(
        input.pitch_arsenal
          .map((pitch) => pitch.trim())
          .filter(Boolean)
      )
    ),
    development_phase: input.development_phase,
    primary_goals: input.primary_goals?.trim() ? input.primary_goals.trim() : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  };
}

export function formatPitcherName(pitcher: Pick<PitcherProfile, 'first_name' | 'last_name'>) {
  return `${pitcher.first_name} ${pitcher.last_name}`.trim();
}

export async function listPitchersForCoach(coachId: string) {
  assertSupabaseConfigured();

  const { data, error } = await supabaseClient
    .from('pitcher_profiles')
    .select('*')
    .eq('created_by', coachId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PitcherProfile[];
}

export async function getPitcherByIdForCoach(pitcherId: string, coachId: string) {
  assertSupabaseConfigured();

  const { data, error } = await supabaseClient
    .from('pitcher_profiles')
    .select('*')
    .eq('id', pitcherId)
    .eq('created_by', coachId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as PitcherProfile | null;
}

export async function createPitcherForCoach(
  coachId: string,
  input: PitcherProfileInput
) {
  assertSupabaseConfigured();

  const payload: PitcherProfileInsert = {
    ...normalizePitcherInput(input),
    created_by: coachId,
  };

  const { data, error } = await supabaseClient
    .from('pitcher_profiles')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as PitcherProfile;
}

export async function updatePitcherForCoach(
  pitcherId: string,
  coachId: string,
  input: PitcherProfileInput
) {
  assertSupabaseConfigured();

  const payload: PitcherProfileUpdate = normalizePitcherInput(input);

  const { data, error } = await supabaseClient
    .from('pitcher_profiles')
    .update(payload)
    .eq('id', pitcherId)
    .eq('created_by', coachId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Pitcher profile not found.');
  }

  return data as PitcherProfile;
}
