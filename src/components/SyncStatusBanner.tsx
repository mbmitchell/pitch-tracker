import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/services/auth';
import { useSyncStatus } from '@/services/sync';
import { colors, spacing } from '@/utils/theme';

function bannerTone(label: string) {
  if (label === 'Offline') {
    return {
      backgroundColor: colors.dangerSoft,
      color: colors.danger,
    };
  }

  if (label === 'Syncing') {
    return {
      backgroundColor: colors.primarySoft,
      color: colors.primary,
    };
  }

  return {
    backgroundColor: colors.successSoft,
    color: colors.success,
  };
}

export function SyncStatusBanner() {
  const { isAuthenticated } = useAuth();
  const { label } = useSyncStatus();

  if (!isAuthenticated) {
    return null;
  }

  const tone = bannerTone(label);

  return (
    <View style={[styles.banner, { backgroundColor: tone.backgroundColor }]}>
      <Text style={[styles.label, { color: tone.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
