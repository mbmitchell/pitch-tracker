import { Pressable, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/services/auth';
import { colors, spacing } from '@/utils/theme';

export function SignOutHeaderButton() {
  const { signOut, isSigningOut } = useAuth();

  return (
    <Pressable
      disabled={isSigningOut}
      onPress={() => {
        void signOut();
      }}
      style={({ pressed }) => [styles.button, (pressed || isSigningOut) && styles.pressed]}
    >
      <Text style={styles.label}>{isSigningOut ? 'Signing out...' : 'Sign out'}</Text>
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
