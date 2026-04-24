import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/services/auth';
import { colors, spacing } from '@/utils/theme';

/** Renders the Phase 1 coach sign-in flow. */
export function SignInScreen() {
  const { authError, clearAuthError, isSigningIn, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit() {
    clearAuthError();
    setValidationError(null);

    if (!email.trim()) {
      setValidationError('Enter the coach account email to continue.');
      return;
    }

    if (!password) {
      setValidationError('Enter your password to sign in.');
      return;
    }

    await signIn({ email, password });
  }

  return (
    <Screen
      title="Welcome back"
      subtitle="Coach-centered access for managing throwing workload, bullpen plans, and pitcher development."
    >
      <SectionCard title="Sign in">
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => {
            setEmail(value);
            if (validationError || authError) {
              clearAuthError();
              setValidationError(null);
            }
          }}
          placeholder="coach@bullpenplanner.com"
          textContentType="emailAddress"
          value={email}
        />
        <TextField
          autoCapitalize="none"
          autoComplete="password"
          label="Password"
          onChangeText={(value) => {
            setPassword(value);
            if (validationError || authError) {
              clearAuthError();
              setValidationError(null);
            }
          }}
          onSubmitEditing={() => {
            void handleSubmit();
          }}
          placeholder="Enter password"
          secureTextEntry
          textContentType="password"
          value={password}
        />
        {validationError || authError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{validationError ?? authError}</Text>
          </View>
        ) : null}
        <PrimaryButton
          disabled={isSigningIn}
          label={isSigningIn ? 'Signing in' : 'Sign in'}
          loading={isSigningIn}
          onPress={() => {
            void handleSubmit();
          }}
        />
      </SectionCard>

      <SectionCard title="Phase 1">
        <Text style={styles.note}>
          Bullpen Planner v1 is coach-centered and uses Supabase email/password auth.
          Pitcher login and role management can layer on later without changing this flow.
        </Text>
      </SectionCard>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Need an account?</Text>
        <Link href="/sign-up" style={styles.link}>
          Create one
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  footerText: {
    color: colors.muted,
    fontSize: 15,
  },
  link: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
