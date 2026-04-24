import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/services/auth';
import { colors, spacing } from '@/utils/theme';

/** Renders the Phase 1 coach sign-up flow. */
export function SignUpScreen() {
  const { authError, clearAuthError, isSigningUp, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit() {
    clearAuthError();
    setValidationError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setValidationError('Enter an email for the coach account.');
      return;
    }

    if (password.length < 8) {
      setValidationError('Use at least 8 characters for the password.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match yet.');
      return;
    }

    const result = await signUp({ email, password });

    if (result.success && result.requiresEmailConfirmation) {
      setSuccessMessage(
        'Account created. Check your inbox to confirm the email before signing in.'
      );
    }
  }

  return (
    <Screen
      title="Create your team workspace"
      subtitle="Create a coach account for Bullpen Planner v1 using Supabase email/password auth."
    >
      <SectionCard title="Sign up">
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => {
            setEmail(value);
            if (validationError || authError || successMessage) {
              clearAuthError();
              setValidationError(null);
              setSuccessMessage(null);
            }
          }}
          placeholder="coach@bullpenplanner.com"
          textContentType="emailAddress"
          value={email}
        />
        <TextField
          autoCapitalize="none"
          autoComplete="new-password"
          label="Password"
          onChangeText={(value) => {
            setPassword(value);
            if (validationError || authError || successMessage) {
              clearAuthError();
              setValidationError(null);
              setSuccessMessage(null);
            }
          }}
          placeholder="Create password"
          secureTextEntry
          textContentType="newPassword"
          value={password}
        />
        <TextField
          autoCapitalize="none"
          autoComplete="new-password"
          label="Confirm password"
          onChangeText={(value) => {
            setConfirmPassword(value);
            if (validationError || authError || successMessage) {
              clearAuthError();
              setValidationError(null);
              setSuccessMessage(null);
            }
          }}
          onSubmitEditing={() => {
            void handleSubmit();
          }}
          placeholder="Re-enter password"
          secureTextEntry
          textContentType="newPassword"
          value={confirmPassword}
        />
        {validationError || authError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{validationError ?? authError}</Text>
          </View>
        ) : null}
        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}
        <PrimaryButton
          disabled={isSigningUp}
          label={isSigningUp ? 'Creating account' : 'Create account'}
          loading={isSigningUp}
          onPress={() => {
            void handleSubmit();
          }}
        />
      </SectionCard>

      <SectionCard title="Coach-centered v1">
        <Text style={styles.note}>
          This flow only creates coach accounts for now. Pitcher login can be added later
          without changing the current profile and workload data model.
        </Text>
      </SectionCard>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Link href="/sign-in" style={styles.link}>
          Sign in
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
  successBanner: {
    backgroundColor: colors.successSoft,
    borderRadius: 14,
    padding: spacing.md,
  },
  successText: {
    color: colors.success,
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
