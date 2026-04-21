import { useLocalSearchParams } from 'expo-router';

import { NewEventScreen } from '@/features/events/screens/NewEventScreen';

export default function NewEventRoute() {
  const { pitcherId } = useLocalSearchParams<{ pitcherId?: string }>();

  return <NewEventScreen initialPitcherId={pitcherId} />;
}
