import { Stack, useLocalSearchParams } from 'expo-router';

import { PitcherDetailScreen } from '@/features/pitchers/screens/PitcherDetailScreen';

export default function PitcherDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Stack.Screen options={{ headerBackTitle: 'Pitchers' }} />
      <PitcherDetailScreen pitcherId={id ?? ''} />
    </>
  );
}
