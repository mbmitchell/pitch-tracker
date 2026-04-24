import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/services/auth';
import { useSyncStatus } from '@/services/sync';
import { colors, spacing } from '@/utils/theme';

type SyncStatusBannerProps = {
  floating?: boolean;
};

function bannerTone({
  failedCount,
  isOnline,
  isSyncing,
  pendingCount,
}: {
  failedCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}) {
  if (!isOnline) {
    return {
      backgroundColor: colors.dangerSoft,
      color: colors.danger,
    };
  }

  if (failedCount > 0) {
    return {
      backgroundColor: colors.dangerSoft,
      color: colors.danger,
    };
  }

  if (isSyncing || pendingCount > 0) {
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

export function SyncStatusBanner({ floating = false }: SyncStatusBannerProps) {
  const { isAuthenticated } = useAuth();
  const { failedCount, isOnline, isSyncing, label, pendingCount } = useSyncStatus();

  if (!isAuthenticated) {
    return null;
  }

  const tone = bannerTone({ failedCount, isOnline, isSyncing, pendingCount });

  return (
    <View
      style={[
        styles.banner,
        floating ? styles.floatingBanner : null,
        { backgroundColor: tone.backgroundColor },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: tone.color }]} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  floatingBanner: {
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
