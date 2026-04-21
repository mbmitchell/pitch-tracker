import { useLocalSearchParams } from 'expo-router';

import { RecommendationsScreen } from '@/features/recommendations/screens/RecommendationsScreen';

export default function RecommendationsRoute() {
  const { pitcherId } = useLocalSearchParams<{ pitcherId: string }>();

  return <RecommendationsScreen pitcherId={pitcherId ?? ''} />;
}
