import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/services/auth';
import { colors, spacing } from '@/utils/theme';

const genericSuccessMessage =
  'If an account exists for that email, a password reset link has been sent.';

/** Renders the Phase 1 forgot-password request flow for coach accounts. */
export function ForgotPasswordScreen() {
  const {
    authError,
    clearAuthError,
    isRequestingPasswordReset,
    requestPasswordReset,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit() {
    clearAuthError();
    setValidationError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setValidationError('Enter the coach account email to continue.');
      return;
    }

    const result = await requestPasswordReset(email);

    if (result.success) {
      setSuccessMessage(genericSuccessMessage);
    }
  }

  return (
    <Screen
      title="Reset password"
      subtitle="Request a password reset email for your PitchReady coach account."
    >
      <SectionCard title="Forgot password">
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
          onSubmitEditing={() => {
            void handleSubmit();
          }}
          placeholder="coach@bullpenplanner.com"
          textContentType="emailAddress"
          value={email}
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
          disabled={isRequestingPasswordReset}
          label={isRequestingPasswordReset ? 'Sending reset link' : 'Send reset link'}
          loading={isRequestingPasswordReset}
          onPress={() => {
            void handleSubmit();
          }}
        />
      </SectionCard>

      <SectionCard title="Phase 1 note">
        <Text style={styles.note}>
          The reset email request is live. To complete password recovery fully inside
          the app, Supabase recovery redirect URLs and a dedicated password update
          callback screen still need to be configured.
        </Text>
      </SectionCard>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Back to sign in?</Text>
        <Link href="/sign-in" style={styles.link}>
          Return
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
