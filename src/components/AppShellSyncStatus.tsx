import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SyncStatusBanner } from '@/components/SyncStatusBanner';
import { useAuth } from '@/services/auth';
import { spacing } from '@/utils/theme';

/**
 * Renders a lightweight floating sync pill for the authenticated app shell.
 *
 * Keeping this at the shell level avoids repeating status UI in every screen
 * while still leaving the app usable during offline work.
 */
export function AppShellSyncStatus() {
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          bottom: Math.max(insets.bottom, spacing.sm) + spacing.sm,
        },
      ]}
    >
      <SyncStatusBanner floating />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
});
