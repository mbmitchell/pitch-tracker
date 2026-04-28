import { useLocalSearchParams } from 'expo-router';

import { AssignWorkoutScreen } from '@/features/workouts/screens/AssignWorkoutScreen';

export default function NewAssignedWorkoutRoute() {
  const { pitcherId } = useLocalSearchParams<{ pitcherId?: string }>();

  return <AssignWorkoutScreen pitcherId={pitcherId ?? ''} />;
}
