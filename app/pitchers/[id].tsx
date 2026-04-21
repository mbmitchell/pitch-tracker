import { useLocalSearchParams } from 'expo-router';

import { PitcherDetailScreen } from '@/features/pitchers/screens/PitcherDetailScreen';

export default function PitcherDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <PitcherDetailScreen pitcherId={id ?? ''} />;
}
