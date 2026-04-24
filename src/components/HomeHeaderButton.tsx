import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, spacing } from '@/utils/theme';

export function HomeHeaderButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        router.replace('/');
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
