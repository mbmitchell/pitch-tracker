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

export type SourceType = 'coach' | 'player' | 'import' | 'system';

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

export type PitcherProfileInviteStatus =
  | 'pending'
  | 'sent'
  | 'accepted'
  | 'expired'
  | 'revoked';

export type PitcherProfileInviteAcceptStatus =
  | 'accepted'
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'already_accepted'
  | 'pitcher_already_linked'
  | 'requires_auth'
  | 'email_mismatch'
  | 'user_already_linked';

export type PlayerPitcherInviteLookupStatus =
  | 'pending'
  | 'sent'
  | 'accepted'
  | 'expired'
  | 'revoked';

export type AssignedWorkoutStatus =
  | 'assigned'
  | 'viewed'
  | 'completed'
  | 'skipped'
  | 'canceled';

export interface PitcherProfileLink {
  id: string;
  pitcher_profile_id: string;
  user_id: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface PitcherProfileInvite {
  id: string;
  pitcher_profile_id: string;
  email: string;
  normalized_email: string;
  created_by_user_id: string;
  status: PitcherProfileInviteStatus;
  token_hash: string;
  token_version: number;
  expires_at: string;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PitcherProfile {
  id: string;
  created_by: string;
  first_name: string;
  last_name: string;
  age: number | null;
  grade: string | null;
  level_team: string | null;
  target_game_ready_date: string | null;
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

export interface AssignedWorkoutPitchMixItem {
  pitch_type: string;
  target_pitches: number;
  share_percent: number;
  intent: string;
}

export interface AssignedWorkoutWorkBlock {
  label: string;
  target_pitches: number;
  intent: string;
}

export interface AssignedWorkout {
  id: string;
  pitcher_id: string;
  assigned_by_user_id: string;
  planned_date: string;
  title: string;
  focus: string;
  target_pitch_count: number;
  intensity: Intensity;
  pitch_mix: AssignedWorkoutPitchMixItem[];
  work_blocks: AssignedWorkoutWorkBlock[];
  coach_notes: string | null;
  status: AssignedWorkoutStatus;
  viewed_at: string | null;
  completed_at: string | null;
  pitcher_feedback: string | null;
  completed_throwing_event_id: string | null;
  created_at: string;
  updated_at: string;
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
          target_game_ready_date?: string | null;
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
          target_game_ready_date?: string | null;
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
      pitcher_profile_links: {
        Row: PitcherProfileLink;
        Insert: {
          id?: string;
          pitcher_profile_id: string;
          user_id: string;
          created_by_user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pitcher_profile_id?: string;
          user_id?: string;
          created_by_user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pitcher_profile_links_created_by_user_id_fkey';
            columns: ['created_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pitcher_profile_links_pitcher_profile_id_fkey';
            columns: ['pitcher_profile_id'];
            isOneToOne: true;
            referencedRelation: 'pitcher_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pitcher_profile_links_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      pitcher_profile_invites: {
        Row: PitcherProfileInvite;
        Insert: {
          id?: string;
          pitcher_profile_id: string;
          email: string;
          normalized_email: string;
          created_by_user_id: string;
          status?: PitcherProfileInviteStatus;
          token_hash: string;
          token_version?: number;
          expires_at: string;
          accepted_by_user_id?: string | null;
          accepted_at?: string | null;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pitcher_profile_id?: string;
          email?: string;
          normalized_email?: string;
          created_by_user_id?: string;
          status?: PitcherProfileInviteStatus;
          token_hash?: string;
          token_version?: number;
          expires_at?: string;
          accepted_by_user_id?: string | null;
          accepted_at?: string | null;
          last_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pitcher_profile_invites_accepted_by_user_id_fkey';
            columns: ['accepted_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pitcher_profile_invites_created_by_user_id_fkey';
            columns: ['created_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pitcher_profile_invites_pitcher_profile_id_fkey';
            columns: ['pitcher_profile_id'];
            isOneToOne: false;
            referencedRelation: 'pitcher_profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      assigned_workouts: {
        Row: AssignedWorkout;
        Insert: {
          id?: string;
          pitcher_id: string;
          assigned_by_user_id: string;
          planned_date: string;
          title: string;
          focus: string;
          target_pitch_count: number;
          intensity: Intensity;
          pitch_mix?: AssignedWorkoutPitchMixItem[];
          work_blocks?: AssignedWorkoutWorkBlock[];
          coach_notes?: string | null;
          status?: AssignedWorkoutStatus;
          viewed_at?: string | null;
          completed_at?: string | null;
          pitcher_feedback?: string | null;
          completed_throwing_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pitcher_id?: string;
          assigned_by_user_id?: string;
          planned_date?: string;
          title?: string;
          focus?: string;
          target_pitch_count?: number;
          intensity?: Intensity;
          pitch_mix?: AssignedWorkoutPitchMixItem[];
          work_blocks?: AssignedWorkoutWorkBlock[];
          coach_notes?: string | null;
          status?: AssignedWorkoutStatus;
          viewed_at?: string | null;
          completed_at?: string | null;
          pitcher_feedback?: string | null;
          completed_throwing_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assigned_workouts_assigned_by_user_id_fkey';
            columns: ['assigned_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assigned_workouts_completed_throwing_event_id_fkey';
            columns: ['completed_throwing_event_id'];
            isOneToOne: false;
            referencedRelation: 'throwing_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assigned_workouts_pitcher_id_fkey';
            columns: ['pitcher_id'];
            isOneToOne: false;
            referencedRelation: 'pitcher_profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {};
    Functions: {
      accept_pitcher_profile_invite_for_user: {
        Args: {
          p_token_hash: string;
          p_user_id: string;
          p_normalized_email: string;
        };
        Returns: Json;
      };
      accept_pitcher_profile_invite_for_user_by_id: {
        Args: {
          p_invite_id: string;
          p_user_id: string;
          p_normalized_email: string;
        };
        Returns: Json;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
}

export type PitcherProfileInsert =
  Database['public']['Tables']['pitcher_profiles']['Insert'];
export type PitcherProfileUpdate =
  Database['public']['Tables']['pitcher_profiles']['Update'];
export type PitcherProfileLinkInsert =
  Database['public']['Tables']['pitcher_profile_links']['Insert'];
export type PitcherProfileLinkUpdate =
  Database['public']['Tables']['pitcher_profile_links']['Update'];
export type PitcherProfileInviteInsert =
  Database['public']['Tables']['pitcher_profile_invites']['Insert'];
export type PitcherProfileInviteUpdate =
  Database['public']['Tables']['pitcher_profile_invites']['Update'];
export type AssignedWorkoutInsert =
  Database['public']['Tables']['assigned_workouts']['Insert'];
export type AssignedWorkoutUpdate =
  Database['public']['Tables']['assigned_workouts']['Update'];

export type ThrowingEventInsert =
  Database['public']['Tables']['throwing_events']['Insert'];
export type ThrowingEventUpdate =
  Database['public']['Tables']['throwing_events']['Update'];

export type EventPitchBreakdownInsert =
  Database['public']['Tables']['event_pitch_breakdown']['Insert'];
export type EventPitchBreakdownUpdate =
  Database['public']['Tables']['event_pitch_breakdown']['Update'];
