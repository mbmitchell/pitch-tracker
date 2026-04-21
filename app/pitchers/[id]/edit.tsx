import { useLocalSearchParams } from 'expo-router';

import { EditPitcherScreen } from '@/features/pitchers/screens/EditPitcherScreen';

export default function EditPitcherRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <EditPitcherScreen pitcherId={id ?? ''} />;
}
