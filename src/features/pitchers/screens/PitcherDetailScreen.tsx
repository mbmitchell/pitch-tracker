import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/services/auth';
import { listThrowingEventsForPitcher, ThrowingEventRecord } from '@/services/events';
import {
  createPitcherProfileInviteForCoach,
  findPitcherUserByEmailForCoach,
  formatPitcherName,
  getPitcherProfileInviteStatusForCoach,
  getPitcherProfileLinkStatusForCoach,
  linkPitcherProfileToUser,
  PitcherProfileInviteMutationResult,
  PitcherProfileLinkStatus,
  resendPitcherProfileInviteForCoach,
  revokePitcherProfileInviteForCoach,
} from '@/services/pitchers';
import { listAssignedWorkoutsForPitcher } from '@/services/workouts';
import { AssignedWorkout, PitcherProfile, PitcherProfileInvite } from '@/types/models';
import {
  buildSuggestedPreseasonPhaseContext,
  formatArmFeelLabel,
  formatAssignedWorkoutFocusLabel,
  formatAssignedWorkoutStatusLabel,
  buildWorkloadSummary,
  formatBullpenFocusLabel,
  formatDateLabel,
  formatDaysSinceLabel,
  formatDevelopmentPhaseLabel,
  formatEventTypeLabel,
  formatInviteStatusLabel,
  formatIntensityLabel,
  formatPitchCountLabel,
  formatSourceTypeLabel,
  formatSuggestedPreseasonPhaseLabel,
  formatTargetGameReadyCountdownLabel,
  formatTimestampLabel,
  summarizePitchBreakdown,
} from '@/utils/workload';
import { colors, spacing } from '@/utils/theme';

type PitcherDetailScreenProps = {
  pitcherId: string;
};

function formatSummaryEventDate(value: ThrowingEventRecord | null) {
  return value ? formatDateLabel(value.date) : 'No event logged';
}

/** Renders pitcher profile details together with recent workload history. */
export function PitcherDetailScreen({ pitcherId }: PitcherDetailScreenProps) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [pitcher, setPitcher] = useState<PitcherProfile | null>(null);
  const [events, setEvents] = useState<ThrowingEventRecord[]>([]);
  const [linkStatus, setLinkStatus] = useState<PitcherProfileLinkStatus | null>(null);
  const [inviteStatus, setInviteStatus] = useState<PitcherProfileInvite | null>(null);
  const [assignedWorkouts, setAssignedWorkouts] = useState<AssignedWorkout[]>([]);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinkingAccount, setIsLinkingAccount] = useState(false);
  const [isLoadingLinkStatus, setIsLoadingLinkStatus] = useState(false);
  const [isInvitingAccount, setIsInvitingAccount] = useState(false);
  const [isResendingInvite, setIsResendingInvite] = useState(false);
  const [isRevokingInvite, setIsRevokingInvite] = useState(false);
  const [showLinkAccountForm, setShowLinkAccountForm] = useState(false);
  const [showInviteAccountForm, setShowInviteAccountForm] = useState(false);
  const [playerAccountEmail, setPlayerAccountEmail] = useState('');
  const [inviteAccountEmail, setInviteAccountEmail] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadPitcherDetail() {
      if (!user?.id || !pitcherId || !isFocused) {
        return;
      }

      setIsLoading(true);
      setError(null);
      setLinkError(null);
      setLinkSuccess(null);
      setInviteError(null);
      setInviteSuccess(null);
      setWorkoutError(null);

      try {
        const [result, nextLinkStatus, nextInviteStatus, nextAssignedWorkouts] = await Promise.all([
          listThrowingEventsForPitcher(user.id, pitcherId, 12),
          getPitcherProfileLinkStatusForCoach(user.id, pitcherId),
          getPitcherProfileInviteStatusForCoach(user.id, pitcherId),
          listAssignedWorkoutsForPitcher(user.id, pitcherId).catch((workoutLoadError) => {
            setWorkoutError(
              workoutLoadError instanceof Error
                ? workoutLoadError.message
                : 'Assigned workouts could not be loaded.'
            );
            return [] as AssignedWorkout[];
          }),
        ]);
        setPitcher(result.pitcher);
        setEvents(result.events);
        setLinkStatus(nextLinkStatus);
        setInviteStatus(nextInviteStatus);
        setAssignedWorkouts(nextAssignedWorkouts);
        setShowLinkAccountForm(false);
        setShowInviteAccountForm(false);
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : 'Unable to load pitcher profile.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPitcherDetail();
  }, [isFocused, pitcherId, refreshToken, user?.id]);

  if (isLoading) {
    return (
      <FullScreenLoader
        title="Loading pitcher"
        subtitle="Loading this roster profile and recent throwing history."
      />
    );
  }

  if (error || !pitcher) {
    return (
      <Screen title="Pitcher unavailable" subtitle="This roster entry could not be opened.">
        <SectionCard title="Roster">
          <Text style={styles.copy}>{error ?? 'Pitcher profile not found.'}</Text>
          <PrimaryButton
            label="Try again"
            onPress={() => {
              setIsLoading(true);
              setError(null);
              setRefreshToken((value) => value + 1);
            }}
            tone="secondary"
          />
          <PrimaryButton label="Back to pitchers" onPress={() => router.replace('/pitchers')} />
        </SectionCard>
      </Screen>
    );
  }

  const currentPitcher = pitcher;
  const summary = buildWorkloadSummary(events);
  const suggestedPreseasonPhase = buildSuggestedPreseasonPhaseContext(
    currentPitcher.target_game_ready_date
  );
  const visibleAssignedWorkouts = assignedWorkouts.filter((workout) => workout.status !== 'canceled');
  const recentAssignedWorkouts = [...visibleAssignedWorkouts]
    .sort((left, right) => {
      const dateCompare = right.planned_date.localeCompare(left.planned_date);

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return right.created_at.localeCompare(left.created_at);
    })
    .slice(0, 3);

  async function refreshLinkStatus() {
    if (!user?.id) {
      return null;
    }

    setIsLoadingLinkStatus(true);

    try {
      const nextLinkStatus = await getPitcherProfileLinkStatusForCoach(
        user.id,
        currentPitcher.id
      );

      setLinkStatus(nextLinkStatus);

      if (nextLinkStatus) {
        setShowLinkAccountForm(false);
      }

      return nextLinkStatus;
    } finally {
      setIsLoadingLinkStatus(false);
    }
  }

  async function refreshInviteStatus() {
    if (!user?.id) {
      return null;
    }

    setIsLoadingLinkStatus(true);

    try {
      const nextInviteStatus = await getPitcherProfileInviteStatusForCoach(
        user.id,
        currentPitcher.id
      );

      setInviteStatus(nextInviteStatus);

      if (nextInviteStatus && (nextInviteStatus.status === 'pending' || nextInviteStatus.status === 'sent')) {
        setShowInviteAccountForm(false);
      }

      return nextInviteStatus;
    } finally {
      setIsLoadingLinkStatus(false);
    }
  }

  async function handleLinkPlayerAccount() {
    if (!user?.id) {
      return;
    }

    setLinkError(null);
    setLinkSuccess(null);

    if (!playerAccountEmail.trim()) {
      setLinkError('Enter the player account email to continue.');
      return;
    }

    if (linkStatus) {
      setLinkError('This pitcher is already linked to a player account.');
      return;
    }

    setIsLinkingAccount(true);

    try {
      const targetUser = await findPitcherUserByEmailForCoach(
        user.id,
        currentPitcher.id,
        playerAccountEmail
      );

      if (!targetUser?.user_id) {
        setLinkError('User not found for that email.');
        return;
      }

      await linkPitcherProfileToUser(user.id, currentPitcher.id, targetUser.user_id);
      const nextLinkStatus = await refreshLinkStatus();
      setPlayerAccountEmail('');
      setLinkSuccess(
        `Linked player account: ${
          nextLinkStatus?.linked_email ?? targetUser.email ?? playerAccountEmail.trim()
        }`
      );
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : 'Unable to link player account.';

      if (message.includes('already linked')) {
        const nextLinkStatus = await refreshLinkStatus();

        if (nextLinkStatus) {
          setPlayerAccountEmail('');
          setLinkError(null);
          setLinkSuccess(
            `Player account already linked: ${
              nextLinkStatus.linked_email ?? 'Email unavailable'
            }`
          );
          return;
        }
      }

      setLinkError(message);
    } finally {
      setIsLinkingAccount(false);
    }
  }

  async function handleCreateInvite() {
    if (!user?.id) {
      return;
    }

    setInviteError(null);
    setInviteSuccess(null);

    if (!inviteAccountEmail.trim()) {
      setInviteError('Enter the player email to create an invite.');
      return;
    }

    if (linkStatus) {
      setInviteError('This pitcher is already linked to a player account.');
      return;
    }

    setIsInvitingAccount(true);

    try {
      const result = (await createPitcherProfileInviteForCoach(
        user.id,
        currentPitcher.id,
        inviteAccountEmail
      )) as PitcherProfileInviteMutationResult;

      await refreshInviteStatus();
      setInviteAccountEmail('');
      setShowInviteAccountForm(false);
      setInviteSuccess(
        [
          result.wasCreated
            ? `Invite created for ${result.invite.normalized_email}.`
            : `Active invite refreshed for ${result.invite.normalized_email}.`,
          result.deliveryMessage,
        ]
          .filter(Boolean)
          .join(' ')
      );
    } catch (nextError) {
      setInviteError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to create player invite.'
      );
    } finally {
      setIsInvitingAccount(false);
    }
  }

  async function handleRevokeInvite() {
    if (!user?.id || !inviteStatus) {
      return;
    }

    setInviteError(null);
    setInviteSuccess(null);
    setIsRevokingInvite(true);

    try {
      const revokedInvite = await revokePitcherProfileInviteForCoach(user.id, inviteStatus.id);
      setInviteStatus(revokedInvite);
      setShowInviteAccountForm(false);
      setInviteSuccess(`Invite revoked for ${revokedInvite.normalized_email}.`);
    } catch (nextError) {
      setInviteError(
        nextError instanceof Error ? nextError.message : 'Unable to revoke invite.'
      );
    } finally {
      setIsRevokingInvite(false);
    }
  }

  async function handleResendInvite() {
    if (!user?.id) {
      return;
    }

    setInviteError(null);
    setInviteSuccess(null);
    setIsResendingInvite(true);

    try {
      const result = await resendPitcherProfileInviteForCoach(user.id, currentPitcher.id);
      const nextInviteStatus = await refreshInviteStatus();
      setInviteSuccess(
        [
          `Invite resent to ${nextInviteStatus?.normalized_email ?? result.invite.normalized_email}.`,
          result.deliveryMessage,
        ]
          .filter(Boolean)
          .join(' ')
      );
    } catch (nextError) {
      setInviteError(
        nextError instanceof Error ? nextError.message : 'Unable to resend invite.'
      );
    } finally {
      setIsResendingInvite(false);
    }
  }

  const hasActiveInvite = inviteStatus?.status === 'pending' || inviteStatus?.status === 'sent';

  return (
    <Screen
      title={formatPitcherName(pitcher)}
      subtitle="Coach-owned profile details with recent throwing workload history."
    >
      <SectionCard title="Profile">
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Age</Text>
          <Text style={styles.metricValue}>{currentPitcher.age ?? 'Not entered'}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Grade</Text>
          <Text style={styles.metricValue}>{currentPitcher.grade ?? 'Not entered'}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Level / team</Text>
          <Text style={styles.metricValue}>{currentPitcher.level_team ?? 'Not entered'}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Target Game-Ready Date</Text>
          <Text style={styles.metricValue}>
            {currentPitcher.target_game_ready_date
              ? formatDateLabel(currentPitcher.target_game_ready_date)
              : 'Not set'}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Handedness</Text>
          <Text style={styles.metricValue}>{currentPitcher.handedness}</Text>
        </View>
      </SectionCard>

      <SectionCard title="Development">
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Coach-selected phase</Text>
          <Text style={styles.metricValue}>
            {formatDevelopmentPhaseLabel(currentPitcher.development_phase)}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Suggested preseason phase</Text>
          <Text style={styles.metricValue}>
            {suggestedPreseasonPhase
              ? formatSuggestedPreseasonPhaseLabel(
                  suggestedPreseasonPhase.suggested_phase
                )
              : 'Target date not set'}
          </Text>
        </View>
        {suggestedPreseasonPhase ? (
          <Text style={styles.copy}>
            Based on the target date, the pitcher is{' '}
            {formatTargetGameReadyCountdownLabel(suggestedPreseasonPhase)}.
          </Text>
        ) : null}
        <Text style={styles.copy}>
          Arsenal: {currentPitcher.pitch_arsenal.length ? currentPitcher.pitch_arsenal.join(', ') : 'No arsenal entered'}
        </Text>
        <Text style={styles.copy}>
          Goals: {currentPitcher.primary_goals ?? 'No primary goals entered'}
        </Text>
        <Text style={styles.copy}>Notes: {currentPitcher.notes ?? 'No notes entered'}</Text>
      </SectionCard>

      <SectionCard title="Player account">
        {isLoadingLinkStatus ? (
          <Text style={styles.copy}>Refreshing player account status...</Text>
        ) : linkStatus ? (
          <>
            <Text style={styles.copy}>Status: Linked</Text>
            <Text style={styles.copy}>
              Account: {linkStatus.linked_email ?? 'Email unavailable'}
            </Text>
            <Text style={styles.copy}>
              Linked on: {formatDateLabel(linkStatus.link.created_at)}
            </Text>
            {inviteStatus ? (
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Latest invite</Text>
                <Text style={styles.copy}>
                  Status: {formatInviteStatusLabel(inviteStatus.status)}
                </Text>
                <Text style={styles.copy}>Invited email: {inviteStatus.email}</Text>
                {inviteStatus.accepted_at ? (
                  <Text style={styles.copy}>
                    Accepted: {formatTimestampLabel(inviteStatus.accepted_at)}
                  </Text>
                ) : null}
                <Text style={styles.copy}>
                  Expires: {formatTimestampLabel(inviteStatus.expires_at)}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.copy}>
              Status: {hasActiveInvite ? 'Invite in progress' : 'Not linked yet'}
            </Text>
            <Text style={styles.copy}>
              Use a direct account link for existing users, or create a pending invite for a player who has not signed up yet.
            </Text>
            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>Pending invite</Text>
              {inviteStatus ? (
                <>
                  <Text style={styles.copy}>
                    Status: {formatInviteStatusLabel(inviteStatus.status)}
                  </Text>
                  <Text style={styles.copy}>
                    Invited email: {inviteStatus.email}
                  </Text>
                  <Text style={styles.copy}>
                    Expires: {formatTimestampLabel(inviteStatus.expires_at)}
                  </Text>
                  <Text style={styles.copy}>
                    Created: {formatTimestampLabel(inviteStatus.created_at)}
                  </Text>
                  {inviteStatus.last_sent_at ? (
                    <Text style={styles.copy}>
                      Last sent: {formatTimestampLabel(inviteStatus.last_sent_at)}
                    </Text>
                  ) : null}
                  {inviteStatus.status === 'pending' || inviteStatus.status === 'sent' ? (
                    <>
                      <PrimaryButton
                        disabled={isResendingInvite}
                        label={isResendingInvite ? 'Resending invite' : 'Resend invite'}
                        loading={isResendingInvite}
                        onPress={() => {
                          void handleResendInvite();
                        }}
                        tone="secondary"
                      />
                      <PrimaryButton
                        disabled={isRevokingInvite}
                        label={isRevokingInvite ? 'Revoking invite' : 'Revoke invite'}
                        loading={isRevokingInvite}
                        onPress={() => {
                          void handleRevokeInvite();
                        }}
                        tone="secondary"
                      />
                    </>
                  ) : inviteStatus.status !== 'accepted' ? (
                    <PrimaryButton
                      label="Create new invite"
                      onPress={() => {
                        setShowInviteAccountForm(true);
                        setInviteError(null);
                        setInviteSuccess(null);
                      }}
                      tone="secondary"
                    />
                  ) : null}
                </>
              ) : !showInviteAccountForm ? (
                <PrimaryButton
                  label="Invite Player Account"
                  onPress={() => {
                    setShowInviteAccountForm(true);
                    setInviteError(null);
                    setInviteSuccess(null);
                  }}
                  tone="secondary"
                />
              ) : (
                <>
                  <TextField
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    label="Player email"
                    onChangeText={(value) => {
                      setInviteAccountEmail(value);
                      if (inviteError || inviteSuccess) {
                        setInviteError(null);
                        setInviteSuccess(null);
                      }
                    }}
                    placeholder="player@bullpenplanner.com"
                    textContentType="emailAddress"
                    value={inviteAccountEmail}
                  />
                  {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
                  {inviteSuccess ? <Text style={styles.successText}>{inviteSuccess}</Text> : null}
                  <PrimaryButton
                    disabled={isInvitingAccount}
                    label={isInvitingAccount ? 'Creating invite' : 'Create invite'}
                    loading={isInvitingAccount}
                    onPress={() => {
                      void handleCreateInvite();
                    }}
                  />
                  <PrimaryButton
                    label="Cancel"
                    onPress={() => {
                      setShowInviteAccountForm(false);
                      setInviteAccountEmail('');
                      setInviteError(null);
                      setInviteSuccess(null);
                    }}
                    tone="secondary"
                  />
                </>
              )}
            </View>

            {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
            {inviteSuccess ? <Text style={styles.successText}>{inviteSuccess}</Text> : null}

            <View style={styles.subsection}>
              <Text style={styles.subsectionTitle}>Manual link for existing account</Text>
              <Text style={styles.copy}>
                Link this pitcher profile directly when the player already has a PitchReady
                account.
              </Text>
              {!showLinkAccountForm ? (
                <PrimaryButton
                  label="Link Player Account"
                  onPress={() => {
                    setShowLinkAccountForm(true);
                    setLinkError(null);
                    setLinkSuccess(null);
                  }}
                  tone="secondary"
                />
              ) : (
                <>
                  <TextField
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    label="Player account email"
                    onChangeText={(value) => {
                      setPlayerAccountEmail(value);
                      if (linkError || linkSuccess) {
                        setLinkError(null);
                        setLinkSuccess(null);
                      }
                    }}
                    placeholder="player@bullpenplanner.com"
                    textContentType="emailAddress"
                    value={playerAccountEmail}
                  />
                  {linkError ? <Text style={styles.errorText}>{linkError}</Text> : null}
                  {linkSuccess ? <Text style={styles.successText}>{linkSuccess}</Text> : null}
                  <PrimaryButton
                    disabled={isLinkingAccount}
                    label={isLinkingAccount ? 'Linking account' : 'Link account'}
                    loading={isLinkingAccount}
                    onPress={() => {
                      void handleLinkPlayerAccount();
                    }}
                  />
                  <PrimaryButton
                    label="Cancel"
                    onPress={() => {
                      setShowLinkAccountForm(false);
                      setPlayerAccountEmail('');
                      setLinkError(null);
                      setLinkSuccess(null);
                    }}
                    tone="secondary"
                  />
                </>
              )}
            </View>
          </>
        )}
      </SectionCard>

      <SectionCard title="Workload summary">
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Last bullpen</Text>
          <Text style={styles.metricValue}>{formatSummaryEventDate(summary.lastBullpen)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Last outing</Text>
          <Text style={styles.metricValue}>{formatSummaryEventDate(summary.lastOuting)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Days since last throw</Text>
          <Text style={styles.metricValue}>{formatDaysSinceLabel(summary.daysSinceLastThrowingEvent)}</Text>
        </View>
      </SectionCard>

      <SectionCard title="Assigned workouts">
        {!linkStatus ? (
          <Text style={styles.copy}>
            Link a player account before assigning workouts from this pitcher profile.
          </Text>
        ) : workoutError ? (
          <>
            <Text style={styles.copy}>{workoutError}</Text>
            <PrimaryButton
              label="Assign workout"
              onPress={() =>
                router.push({
                  pathname: '/workouts/new',
                  params: { pitcherId: currentPitcher.id },
                })
              }
              tone="secondary"
            />
          </>
        ) : recentAssignedWorkouts.length === 0 ? (
          <>
            <Text style={styles.copy}>
              No assigned workouts yet for this linked player account.
            </Text>
            <PrimaryButton
              label="Assign workout"
              onPress={() =>
                router.push({
                  pathname: '/workouts/new',
                  params: { pitcherId: currentPitcher.id },
                })
              }
            />
          </>
        ) : (
          <>
            {recentAssignedWorkouts.map((workout) => (
              <View key={workout.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={styles.historyHeaderCopy}>
                    <Text style={styles.historyTitle}>{workout.title}</Text>
                    <Text style={styles.historyMeta}>
                      {formatDateLabel(workout.planned_date)} • {formatAssignedWorkoutStatusLabel(workout.status)}
                    </Text>
                  </View>
                  <Text style={styles.historyMeta}>
                    {formatPitchCountLabel(workout.target_pitch_count)}
                  </Text>
                </View>
                <Text style={styles.copy}>
                  Focus: {formatAssignedWorkoutFocusLabel(workout.focus)} • Intensity:{' '}
                  {formatIntensityLabel(workout.intensity)}
                </Text>
                <Text style={styles.copy}>
                  Source: Coach assigned
                  {workout.completed_at ? ' • Completion: Player completed' : ''}
                </Text>
                {workout.coach_notes ? (
                  <Text style={styles.copy}>Coach notes: {workout.coach_notes}</Text>
                ) : null}
                {workout.pitcher_feedback ? (
                  <Text style={styles.copy}>
                    Player feedback: {workout.pitcher_feedback}
                  </Text>
                ) : null}
                {workout.completed_at ? (
                  <Text style={styles.copy}>
                    Completed: {formatTimestampLabel(workout.completed_at)}
                  </Text>
                ) : null}
              </View>
            ))}
            <PrimaryButton
              label="Assign another workout"
              onPress={() =>
                router.push({
                  pathname: '/workouts/new',
                  params: { pitcherId: currentPitcher.id },
                })
              }
              tone="secondary"
            />
          </>
        )}
      </SectionCard>

      <SectionCard title="Recent throwing history">
        {events.length === 0 ? (
          <>
            <Text style={styles.copy}>
              No throwing events logged yet for this pitcher.
            </Text>
            <PrimaryButton
              label="Add first event"
              onPress={() =>
                router.push({
                  pathname: '/events/new',
                  params: { pitcherId: currentPitcher.id },
                })
              }
            />
          </>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={styles.historyHeaderCopy}>
                  <Text style={styles.historyTitle}>{formatEventTypeLabel(event.event_type)}</Text>
                  <Text style={styles.historyMeta}>
                    {formatDateLabel(event.date)} • {formatSourceTypeLabel(event.source_type)}
                  </Text>
                </View>
                <Text style={styles.historyMeta}>{formatPitchCountLabel(event.total_pitches)}</Text>
              </View>
              <Text style={styles.copy}>
                Intensity: {formatIntensityLabel(event.intensity)} • Arm feel:{' '}
                {formatArmFeelLabel(event.arm_feel)}
              </Text>
              <Text style={styles.copy}>
                Innings: {event.innings_thrown ?? 'N/A'} • Bullpen focus: {formatBullpenFocusLabel(event.bullpen_focus)}
              </Text>
              <Text style={styles.copy}>
                Breakdown: {summarizePitchBreakdown(event)}
              </Text>
              {event.notes ? <Text style={styles.copy}>Notes: {event.notes}</Text> : null}
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title="Actions">
        {linkStatus ? (
          <PrimaryButton
            label="Assign workout"
            onPress={() =>
              router.push({
                pathname: '/workouts/new',
                params: { pitcherId: currentPitcher.id },
              })
            }
          />
        ) : null}
        <PrimaryButton
          label="Add throwing event"
          onPress={() =>
            router.push({
              pathname: '/events/new',
              params: { pitcherId: currentPitcher.id },
            })
          }
        />
        <PrimaryButton
          label="Edit pitcher"
          onPress={() =>
            router.push({
              pathname: '/pitchers/[id]/edit',
              params: { id: currentPitcher.id },
            })
          }
          tone="secondary"
        />
        <PrimaryButton
          label="View recommendations"
          onPress={() =>
            router.push({
              pathname: '/recommendations/[pitcherId]',
              params: { pitcherId: currentPitcher.id },
            })
          }
          tone="secondary"
        />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metricLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.muted,
  },
  metricValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
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
  historyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  historyHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  historyMeta: {
    fontSize: 13,
    color: colors.muted,
  },
  successText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.success,
  },
  subsection: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
