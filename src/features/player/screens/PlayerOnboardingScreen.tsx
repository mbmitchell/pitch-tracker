import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useHeaderHeight } from '@react-navigation/elements';
import { StyleSheet, Text } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { PitcherProfileForm } from '@/features/pitchers/components/PitcherProfileForm';
import { useAuth } from '@/services/auth';
import {
  acceptPendingPitcherProfileInviteForUser,
  createPitcherForCoach,
  linkPitcherProfileToUser,
  listPendingPitcherProfileInvitesForUser,
  PlayerPendingPitcherInvite,
} from '@/services/pitchers';
import { getIsOnline } from '@/services/sync';
import { colors, spacing } from '@/utils/theme';
import { formatInviteStatusLabel, formatTimestampLabel } from '@/utils/workload';

import type { PitcherProfile } from '@/types/models';
import type { PitcherProfileInput } from '@/services/pitchers';

/** Completes first-time player setup by creating and self-linking a pitcher profile. */
export function PlayerOnboardingScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { refreshProfileAccess, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PlayerPendingPitcherInvite[]>([]);
  const [dismissedInviteIds, setDismissedInviteIds] = useState<string[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);

  useEffect(() => {
    async function loadPendingInvites() {
      if (!user?.id) {
        setPendingInvites([]);
        setIsLoadingInvites(false);
        return;
      }

      setIsLoadingInvites(true);
      setInviteError(null);

      try {
        setPendingInvites(await listPendingPitcherProfileInvitesForUser());
      } catch (error) {
        setInviteError(
          error instanceof Error ? error.message : 'Unable to check for pending invites.'
        );
      } finally {
        setIsLoadingInvites(false);
      }
    }

    void loadPendingInvites();
  }, [user?.id]);

  const visibleInvites = useMemo(
    () => pendingInvites.filter((invite) => !dismissedInviteIds.includes(invite.id)),
    [dismissedInviteIds, pendingInvites]
  );

  async function handleAcceptPendingInvite(invite: PlayerPendingPitcherInvite) {
    if (!user?.id || isSubmitting || isRedirecting) {
      return;
    }

    setInviteError(null);
    setAcceptingInviteId(invite.id);

    try {
      const result = await acceptPendingPitcherProfileInviteForUser(invite.id);

      if (result.status === 'accepted') {
        refreshProfileAccess();
        router.replace('/player');
        return;
      }

      const refreshedInvites = await listPendingPitcherProfileInvitesForUser();
      setPendingInvites(refreshedInvites);

      switch (result.status) {
        case 'expired':
          setInviteError('This invite has expired. Ask the coach to send a new one.');
          break;
        case 'revoked':
          setInviteError('This invite has been revoked by the coach.');
          break;
        case 'already_accepted':
          setInviteError('This invite was already accepted. Try opening your player view.');
          break;
        case 'pitcher_already_linked':
          setInviteError('This pitcher profile is already linked to another player account.');
          break;
        case 'user_already_linked':
          setInviteError('This account is already linked to another pitcher profile.');
          break;
        case 'email_mismatch':
          setInviteError('This signed-in email does not match the invite.');
          break;
        default:
          setInviteError('This invite is no longer available.');
          break;
      }
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : 'Unable to accept the pending invite.'
      );
    } finally {
      setAcceptingInviteId(null);
    }
  }

  async function handleFinishSetup(input: PitcherProfileInput) {
    if (isSubmitting || isRedirecting) {
      return;
    }

    if (!user?.id) {
      setSubmitError('You must be signed in to finish player setup.');
      return;
    }

    if (!getIsOnline()) {
      setSubmitError('Player setup needs an internet connection right now so your account can be linked.');
      return;
    }

    let createdPitcher: PitcherProfile | null = null;
    let completed = false;

    setIsSubmitting(true);
    setIsRedirecting(false);
    setSubmitError(null);

    try {
      createdPitcher = await createPitcherForCoach(user.id, input);
      await linkPitcherProfileToUser(user.id, createdPitcher.id, user.id);
      completed = true;
      setIsRedirecting(true);
      refreshProfileAccess();
      router.replace('/player');
    } catch (error) {
      const fallbackMessage = createdPitcher
        ? 'Your pitcher profile was created, but the player account link could not be completed yet.'
        : 'Unable to finish player setup.';

      setSubmitError(error instanceof Error ? error.message : fallbackMessage);
      setIsRedirecting(false);
    } finally {
      if (!completed) {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <Screen
      contentContainerStyle={{ paddingBottom: 48 }}
      keyboardAware
      keyboardVerticalOffset={headerHeight}
      subtitle="Create your pitcher profile so PitchReady can show your own recommendation and workload history."
      title="Player setup"
    >
      {isLoadingInvites ? (
        <SectionCard title="Checking invites">
          <PrimaryButton
            disabled
            label="Checking for coach invites"
            loading
            onPress={() => undefined}
            tone="secondary"
          />
        </SectionCard>
      ) : null}

      {visibleInvites.length > 0 ? (
        <SectionCard title="You have a pending invite">
          {visibleInvites.map((invite) => (
            <SectionCard
              key={invite.id}
              title={invite.pitcherName ?? 'Coach-linked pitcher profile'}
            >
              <InviteRow label="Status" value={formatInviteStatusLabel(invite.status)} />
              <InviteRow label="Invited email" value={invite.invitedEmail} />
              <InviteRow label="Expires" value={formatTimestampLabel(invite.expiresAt)} />
              {invite.acceptedAt ? (
                <InviteRow
                  label="Accepted"
                  value={formatTimestampLabel(invite.acceptedAt)}
                />
              ) : null}
              <PrimaryButton
                disabled={acceptingInviteId === invite.id || isSubmitting || isRedirecting}
                label={
                  acceptingInviteId === invite.id ? 'Accepting invite' : 'Accept invite'
                }
                loading={acceptingInviteId === invite.id}
                onPress={() => {
                  void handleAcceptPendingInvite(invite);
                }}
              />
              {invite.status === 'pending' || invite.status === 'sent' ? (
                <PrimaryButton
                  label="Not now"
                  onPress={() => {
                    setDismissedInviteIds((current) => [...current, invite.id]);
                  }}
                  tone="secondary"
                />
              ) : null}
            </SectionCard>
          ))}
          <InviteRow
            label="Note"
            value="You can accept a coach invite here, or continue with your own solo pitcher setup."
          />
          {inviteError ? <InviteRow label="Invite status" value={inviteError} tone="error" /> : null}
        </SectionCard>
      ) : inviteError ? (
        <SectionCard title="Invite status">
          <InviteRow label="Status" value={inviteError} tone="error" />
        </SectionCard>
      ) : null}

      <PitcherProfileForm
        isSubmitting={isSubmitting || isRedirecting}
        mode="create"
        onSubmit={handleFinishSetup}
        submitError={submitError}
        submitLabel={isRedirecting ? 'Opening player view' : 'Finish player setup'}
      />
    </Screen>
  );
}

function InviteRow({
  label,
  tone = 'default',
  value,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'error';
}) {
  return (
    <>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={tone === 'error' ? styles.errorText : styles.metaValue}>{value}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  metaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  metaValue: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
});
