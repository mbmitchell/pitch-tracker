import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { useAuth } from '@/services/auth';
import {
  acceptPitcherProfileInviteForUser,
  PitcherProfileInviteValidationResult,
  validatePitcherProfileInviteToken,
} from '@/services/pitchers';
import { colors, spacing } from '@/utils/theme';
import { formatTimestampLabel } from '@/utils/workload';

function getInviteTitle(status: PitcherProfileInviteValidationResult['status']) {
  switch (status) {
    case 'expired':
      return 'Invite expired';
    case 'revoked':
      return 'Invite revoked';
    case 'already_accepted':
      return 'Invite already accepted';
    case 'pitcher_already_linked':
      return 'Pitcher already linked';
    case 'email_mismatch':
      return 'Email does not match invite';
    case 'user_already_linked':
      return 'Account already linked';
    case 'ready_to_accept':
      return 'Invite ready';
    case 'requires_auth':
      return 'Continue to sign in or create an account';
    default:
      return 'Invite unavailable';
  }
}

function getInviteMessage(result: PitcherProfileInviteValidationResult, signedInEmail: string | null) {
  switch (result.status) {
    case 'expired':
      return 'This invite has expired. Ask the coach to send a new Bullpen Planner invite.';
    case 'revoked':
      return 'This invite is no longer active. Ask the coach to send a new invite if you still need access.';
    case 'already_accepted':
      return 'This invite has already been accepted. If this is your pitcher account, you can continue to your player view.';
    case 'pitcher_already_linked':
      return 'This pitcher profile is already linked to a player account. Ask the coach if you expected access here.';
    case 'email_mismatch':
      return `You are signed in as ${signedInEmail ?? 'another account'}, but this invite was sent to ${result.context?.invitedEmail ?? 'a different email'}.`;
    case 'user_already_linked':
      return 'This account is already linked to another pitcher profile, so the invite cannot continue.';
    case 'ready_to_accept':
      return 'Your invite is valid. Accept it here to link this account to the pitcher profile.';
    case 'requires_auth':
      return 'Sign in or create an account with the invited email to continue.';
    default:
      return 'This invite link is invalid or unavailable.';
  }
}

/** Renders the secure invite validation and auth continuation flow. */
export function InviteAcceptScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { isAuthenticated, refreshProfileAccess, user } = useAuth();
  const [result, setResult] = useState<PitcherProfileInviteValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadInvite() {
      if (!token) {
        setResult({ status: 'invalid' });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        setResult(await validatePitcherProfileInviteToken(token));
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : 'Unable to validate invite.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadInvite();
  }, [refreshToken, token, user?.id]);

  if (isLoading) {
    return (
      <FullScreenLoader
        title="Checking invite"
        subtitle="Validating your Bullpen Planner invite."
      />
    );
  }

  const currentResult = result ?? { status: 'invalid' as const };
  const signedInEmail = user?.email ?? null;

  async function handleAcceptInvite() {
    if (!token || !isAuthenticated) {
      return;
    }

    setError(null);
    setAcceptSuccess(null);
    setIsAccepting(true);

    try {
      const acceptResult = await acceptPitcherProfileInviteForUser(token);

      if (acceptResult.status !== 'accepted') {
        setRefreshToken((value) => value + 1);
        return;
      }

      setAcceptSuccess('Invite accepted. Opening your player view.');
      refreshProfileAccess();
      router.replace('/player');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to accept invite.');
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <Screen
      title={getInviteTitle(currentResult.status)}
      subtitle="Bullpen Planner player access invite"
    >
      <SectionCard title="Invite">
        <Text style={styles.copy}>{getInviteMessage(currentResult, signedInEmail)}</Text>
        {currentResult.context?.pitcherName ? (
          <Text style={styles.copy}>Pitcher: {currentResult.context.pitcherName}</Text>
        ) : null}
        {currentResult.context?.invitedEmail ? (
          <Text style={styles.copy}>Invited email: {currentResult.context.invitedEmail}</Text>
        ) : null}
        {currentResult.expiresAt ? (
          <Text style={styles.copy}>Expires: {formatTimestampLabel(currentResult.expiresAt)}</Text>
        ) : null}
        {acceptSuccess ? <Text style={styles.successText}>{acceptSuccess}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton
          disabled={isAccepting}
          label={isAccepting ? 'Accepting invite' : 'Check again'}
          onPress={() => {
            setIsLoading(true);
            setError(null);
            setAcceptSuccess(null);
            setRefreshToken((value) => value + 1);
          }}
          tone="secondary"
        />
      </SectionCard>

      {!isAuthenticated && token ? (
        <SectionCard title="Continue">
          <Link
            href={{ pathname: '/sign-in', params: { inviteToken: token } }}
            style={styles.link}
          >
            Sign in
          </Link>
          <Link
            href={{ pathname: '/sign-up', params: { inviteToken: token } }}
            style={styles.link}
          >
            Create account
          </Link>
        </SectionCard>
      ) : null}

      {isAuthenticated && currentResult.status === 'ready_to_accept' ? (
        <SectionCard title="Next step">
          <Text style={styles.copy}>
            Invite validation is complete. Accept the invite to link your account and open your player view.
          </Text>
          <PrimaryButton
            disabled={isAccepting}
            label={isAccepting ? 'Opening player view' : 'Accept invite'}
            loading={isAccepting}
            onPress={() => {
              void handleAcceptInvite();
            }}
          />
        </SectionCard>
      ) : null}

      {isAuthenticated && currentResult.status === 'already_accepted' ? (
        <SectionCard title="Continue">
          <Text style={styles.copy}>
            This invite has already been used. If this is your pitcher account, open your player view.
          </Text>
          <PrimaryButton
            label="Open player view"
            onPress={() => {
              refreshProfileAccess();
              router.replace('/player');
            }}
          />
        </SectionCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.danger,
  },
  link: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  successText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.success,
  },
});
