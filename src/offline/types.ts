import {
  EventPitchBreakdown,
  PitcherProfile,
  ThrowingEvent,
} from '@/types/models';

export type OfflineSyncQueueStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export type OfflineEntityType =
  | 'pitcher_profile'
  | 'throwing_event'
  | 'event_pitch_breakdown';

export type OfflineMutationType =
  | 'create'
  | 'update'
  | 'delete'
  | 'upsert_breakdown';

export type OfflineSyncQueueRecord = {
  id: string;
  coach_id: string;
  mutation_type: OfflineMutationType;
  entity_type: OfflineEntityType;
  entity_id: string;
  payload_json: string;
  status: OfflineSyncQueueStatus;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type CachedPitcherProfileRow = Omit<PitcherProfile, 'pitch_arsenal'> & {
  coach_id: string;
  pitch_arsenal_json: string;
};

export type CachedThrowingEventRow = ThrowingEvent & {
  coach_id: string;
};

export type CachedEventPitchBreakdownRow = EventPitchBreakdown & {
  coach_id: string;
};

export type EnqueueOfflineMutationInput = Omit<
  OfflineSyncQueueRecord,
  'attempt_count' | 'created_at' | 'last_error' | 'updated_at'
>;
