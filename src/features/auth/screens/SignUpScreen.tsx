import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/services/auth';
import { colors, radius, spacing } from '@/utils/theme';

import type { AccountType } from '@/services/auth';

const accountTypeOptions: Array<{
  description: string;
  label: string;
  value: AccountType;
}> = [
  {
    label: "I'm a Coach",
    value: 'coach',
    description: 'Create a coach workspace for roster, workload, and recommendations.',
  },
  {
    label: "I'm a Pitcher / Player",
    value: 'player',
    description: 'Create a player account, then complete your own pitcher profile setup.',
  },
];

/** Renders the Phase 2 sign-up flow for coach and player accounts. */
export function SignUpScreen() {
  const router = useRouter();
  const { inviteToken } = useLocalSearchParams<{ inviteToken?: string }>();
  const { authError, clearAuthError, isSigningUp, signUp } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>('coach');
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
      setValidationError(
        accountType === 'player'
          ? 'Enter an email for the player account.'
          : 'Enter an email for the coach account.'
      );
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

    const result = await signUp({ accountType, email, password });

    if (result.success && !result.requiresEmailConfirmation && inviteToken) {
      router.replace({
        pathname: '/invite/accept',
        params: { token: inviteToken },
      });
      return;
    }

    if (result.success && result.requiresEmailConfirmation) {
      setSuccessMessage(
        inviteToken
          ? 'Account created. Check your inbox to confirm the email, then sign in to continue accepting the invite.'
          : accountType === 'player'
            ? 'Player account created. Check your inbox to confirm the email, then sign in to finish player setup.'
            : 'Account created. Check your inbox to confirm the email before signing in.'
      );
    }
  }

  return (
    <Screen
      title="Create your Bullpen Planner account"
      subtitle={
        inviteToken
          ? 'Create an account to continue your Bullpen Planner invite.'
          : 'Choose the account type first, then finish email/password setup.'
      }
    >
      <SectionCard title="Account type">
        {accountTypeOptions.map((option) => {
          const isSelected = accountType === option.value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => {
                setAccountType(option.value);
                if (validationError || authError || successMessage) {
                  clearAuthError();
                  setValidationError(null);
                  setSuccessMessage(null);
                }
              }}
              style={({ pressed }) => [
                styles.accountTypeCard,
                isSelected ? styles.accountTypeCardSelected : null,
                pressed ? styles.accountTypeCardPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.accountTypeLabel,
                  isSelected ? styles.accountTypeLabelSelected : null,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.accountTypeDescription}>{option.description}</Text>
            </Pressable>
          );
        })}
      </SectionCard>

      <SectionCard title={accountType === 'player' ? 'Player sign up' : 'Coach sign up'}>
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
          label={
            isSigningUp
              ? 'Creating account'
              : accountType === 'player'
                ? 'Create player account'
                : 'Create coach account'
          }
          loading={isSigningUp}
          onPress={() => {
            void handleSubmit();
          }}
        />
      </SectionCard>

      <SectionCard title={accountType === 'player' ? 'Phase 2 testing' : 'Coach-centered v1'}>
        <Text style={styles.note}>
          {inviteToken
            ? 'This account creation continues an invite flow. After authentication, Bullpen Planner will return you to the invite screen.'
            : accountType === 'player'
              ? 'Player accounts go through a short onboarding flow after sign-up so the pitcher profile and self-link can be created for testing.'
              : 'Coach sign-up keeps the existing roster and workload flow unchanged.'}
        </Text>
      </SectionCard>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Link
          href={
            inviteToken
              ? { pathname: '/sign-in', params: { inviteToken } }
              : '/sign-in'
          }
          style={styles.link}
        >
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
  accountTypeCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  accountTypeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  accountTypeCardPressed: {
    opacity: 0.85,
  },
  accountTypeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  accountTypeLabelSelected: {
    color: colors.primary,
  },
  accountTypeDescription: {
    fontSize: 14,
    lineHeight: 20,
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
