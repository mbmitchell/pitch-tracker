import { Pressable, StyleSheet, Text } from 'react-native';
import { Href, useRouter } from 'expo-router';

import { colors, spacing } from '@/utils/theme';

const dashboardHref = '/dashboard' as Href;

export function HomeHeaderButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        router.replace(dashboardHref);
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>Home</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  label: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
});
