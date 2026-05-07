import { Link, useLocalSearchParams, useRouter } from 'expo-router';
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
  const router = useRouter();
  const { inviteToken } = useLocalSearchParams<{ inviteToken?: string }>();
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

    const result = await signIn({ email, password });

    if (result.success && inviteToken) {
      router.replace({
        pathname: '/invite/accept',
        params: { token: inviteToken },
      });
    }
  }

  return (
    <Screen
      title="Welcome back"
      subtitle={
        inviteToken
          ? 'Sign in to continue your PitchReady invite.'
          : 'Coach-centered access for managing throwing workload, bullpen plans, and pitcher development.'
      }
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
        <View style={styles.inlineLinkRow}>
          <Link
            href={
              inviteToken
                ? { pathname: '/forgot-password', params: { inviteToken } }
                : '/forgot-password'
            }
            style={styles.inlineLink}
          >
            Forgot password?
          </Link>
        </View>
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
          {inviteToken
            ? 'This sign-in continues an existing player invite. After authentication, PitchReady will return you to the invite flow.'
            : 'PitchReady v1 is coach-centered and uses Supabase email/password auth. Pitcher login and role management can layer on later without changing this flow.'}
        </Text>
      </SectionCard>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Need an account?</Text>
        <Link
          href={
            inviteToken
              ? { pathname: '/sign-up', params: { inviteToken } }
              : '/sign-up'
          }
          style={styles.link}
        >
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
  inlineLinkRow: {
    alignItems: 'flex-end',
  },
  inlineLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
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
