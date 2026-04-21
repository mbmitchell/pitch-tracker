export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EventType =
  | 'bullpen'
  | 'game_outing'
  | 'live_ab'
  | 'flat_ground'
  | 'long_toss'
  | 'recovery_throw'
  | 'other';

export type SourceType = 'coach' | 'pitcher' | 'import' | 'system';

export type Intensity = 'low' | 'medium' | 'high' | 'max';

export type ArmFeel = 'great' | 'good' | 'neutral' | 'sore' | 'pain';

export type DevelopmentPhase =
  | 'assessment'
  | 'build'
  | 'preseason'
  | 'in_season'
  | 'recovery'
  | 'offseason';

export type BullpenFocus =
  | 'command'
  | 'velocity'
  | 'mechanics'
  | 'secondary_pitches'
  | 'recovery'
  | 'live_execution'
  | 'other';

export type Handedness = 'RHP' | 'LHP' | 'SWITCH';

export interface PitcherProfile {
  id: string;
  created_by: string;
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
  created_at: string;
  updated_at: string;
}

export interface ThrowingEvent {
  id: string;
  pitcher_id: string;
  date: string;
  event_type: EventType;
  total_pitches: number | null;
  innings_thrown: number | null;
  intensity: Intensity;
  arm_feel: ArmFeel;
  bullpen_focus: BullpenFocus | null;
  notes: string | null;
  entered_by_user_id: string;
  source_type: SourceType;
  created_at: string;
  updated_at: string;
}

export interface EventPitchBreakdown {
  id: string;
  event_id: string;
  pitch_type: string;
  pitch_count: number;
}

export interface Database {
  public: {
    Tables: {
      pitcher_profiles: {
        Row: PitcherProfile;
        Insert: {
          id?: string;
          created_by: string;
          first_name: string;
          last_name: string;
          age?: number | null;
          grade?: string | null;
          level_team?: string | null;
          handedness: Handedness;
          pitch_arsenal?: string[];
          development_phase: DevelopmentPhase;
          primary_goals?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          created_by?: string;
          first_name?: string;
          last_name?: string;
          age?: number | null;
          grade?: string | null;
          level_team?: string | null;
          handedness?: Handedness;
          pitch_arsenal?: string[];
          development_phase?: DevelopmentPhase;
          primary_goals?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pitcher_profiles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      throwing_events: {
        Row: ThrowingEvent;
        Insert: {
          id?: string;
          pitcher_id: string;
          date: string;
          event_type: EventType;
          total_pitches?: number | null;
          innings_thrown?: number | null;
          intensity: Intensity;
          arm_feel: ArmFeel;
          bullpen_focus?: BullpenFocus | null;
          notes?: string | null;
          entered_by_user_id: string;
          source_type: SourceType;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pitcher_id?: string;
          date?: string;
          event_type?: EventType;
          total_pitches?: number | null;
          innings_thrown?: number | null;
          intensity?: Intensity;
          arm_feel?: ArmFeel;
          bullpen_focus?: BullpenFocus | null;
          notes?: string | null;
          entered_by_user_id?: string;
          source_type?: SourceType;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'throwing_events_entered_by_user_id_fkey';
            columns: ['entered_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'throwing_events_pitcher_id_fkey';
            columns: ['pitcher_id'];
            isOneToOne: false;
            referencedRelation: 'pitcher_profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      event_pitch_breakdown: {
        Row: EventPitchBreakdown;
        Insert: {
          id?: string;
          event_id: string;
          pitch_type: string;
          pitch_count: number;
        };
        Update: {
          id?: string;
          event_id?: string;
          pitch_type?: string;
          pitch_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'event_pitch_breakdown_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'throwing_events';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}

export type PitcherProfileInsert =
  Database['public']['Tables']['pitcher_profiles']['Insert'];
export type PitcherProfileUpdate =
  Database['public']['Tables']['pitcher_profiles']['Update'];

export type ThrowingEventInsert =
  Database['public']['Tables']['throwing_events']['Insert'];
export type ThrowingEventUpdate =
  Database['public']['Tables']['throwing_events']['Update'];

export type EventPitchBreakdownInsert =
  Database['public']['Tables']['event_pitch_breakdown']['Insert'];
export type EventPitchBreakdownUpdate =
  Database['public']['Tables']['event_pitch_breakdown']['Update'];
