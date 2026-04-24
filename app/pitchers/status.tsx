import { Stack, useLocalSearchParams } from 'expo-router';

import { ReadinessPitcherListScreen } from '@/features/dashboard/screens/ReadinessPitcherListScreen';
import {
  normalizeReadinessFilterKey,
  READINESS_FILTER_CONFIG,
} from '@/features/dashboard/utils/staffOverview';

export default function PitcherStatusRoute() {
  const { filter } = useLocalSearchParams<{ filter?: string | string[] }>();
  const readinessFilter = normalizeReadinessFilterKey(filter);
  const config = READINESS_FILTER_CONFIG[readinessFilter];

  return (
    <>
      <Stack.Screen options={{ title: config.screenTitle }} />
      <ReadinessPitcherListScreen filter={readinessFilter} />
    </>
  );
}
