import { useLocalSearchParams } from 'expo-router';

import { NewEventScreen } from '@/features/events/screens/NewEventScreen';

export default function PlayerLogWorkRoute() {
  const { assignedWorkoutId } = useLocalSearchParams<{ assignedWorkoutId?: string }>();

  return <NewEventScreen assignedWorkoutId={assignedWorkoutId} mode="player" />;
}
