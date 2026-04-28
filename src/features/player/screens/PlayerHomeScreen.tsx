import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { RecommendationPlanSections } from '@/features/recommendations/components/RecommendationPlanSections';
import { useAuth } from '@/services/auth';
import { listThrowingEventsForPitcher, ThrowingEventRecord } from '@/services/events';
import {
  buildBullpenRecommendationInput,
  generateBullpenRecommendation,
} from '@/services/recommendations';
import { formatPitcherName, getLinkedPitcherProfileForUser } from '@/services/pitchers';
import {
  listAssignedWorkoutsForPlayer,
  markAssignedWorkoutsViewedForPlayer,
} from '@/services/workouts';
import { AssignedWorkout, PitcherProfile } from '@/types/models';
import { getTodayIsoDateString } from '@/utils/dates';
import { colors, spacing } from '@/utils/theme';
import {
  buildWorkloadSummary,
  formatAssignedWorkoutFocusLabel,
  formatDateLabel,
  formatDevelopmentPhaseLabel,
  formatAssignedWorkoutStatusLabel,
  formatEventTypeLabel,
  formatIntensityLabel,
  formatPitchCountLabel,
  formatSourceTypeLabel,
} from '@/utils/workload';

function formatAssignedWorkoutSyncNote(workout: AssignedWorkout & { sync_state?: string }) {
  if (!workout.sync_state || workout.sync_state === 'synced') {
    return null;
  }

  switch (workout.sync_state) {
    case 'pending':
      return 'Pending sync';
    case 'syncing':
      return 'Syncing';
    case 'failed':
      return 'Sync issue';
    default:
      return null;
  }
}

/** Renders the linked player home screen with today's plan, assigned workouts, and self-log actions. */
export function PlayerHomeScreen() {
  const router = useRouter();
  const { profileAccessRefreshKey, user } = useAuth();
  const [pitcher, setPitcher] = useState<PitcherProfile | null>(null);
  const [events, setEvents] = useState<ThrowingEventRecord[]>([]);
  const [assignedWorkouts, setAssignedWorkouts] = useState<AssignedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadPlayerView() {
      if (!user?.id) {
        return;
      }

      setIsLoading(true);
      setError(null);
      setWorkoutError(null);

      try {
        const linkedPitcher = await getLinkedPitcherProfileForUser(user.id);

        if (!linkedPitcher) {
          setPitcher(null);
          setEvents([]);
          setAssignedWorkouts([]);
          return;
        }

        const [result, workouts] = await Promise.all([
          listThrowingEventsForPitcher(user.id, linkedPitcher.id, 12),
          listAssignedWorkoutsForPlayer(user.id).catch((workoutLoadError) => {
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
        setAssignedWorkouts(workouts);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to load your player view.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPlayerView();
  }, [profileAccessRefreshKey, refreshToken, user?.id]);

  useEffect(() => {
    async function markVisibleAssignedWorkouts() {
      if (!user?.id) {
        return;
      }

      const visibleAssignedIds = assignedWorkouts
        .filter((workout) => workout.status === 'assigned')
        .map((workout) => workout.id);

      if (!visibleAssignedIds.length) {
        return;
      }

      try {
        const updated = await markAssignedWorkoutsViewedForPlayer(user.id, visibleAssignedIds);

        if (!updated.length) {
          return;
        }

        setAssignedWorkouts((current) =>
          current.map((workout) => updated.find((item) => item.id === workout.id) ?? workout)
        );
      } catch (markError) {
        if (__DEV__) {
          console.warn(
            '[assigned-workouts] unable to mark workouts viewed',
            markError instanceof Error ? markError.message : markError
          );
        }
      }
    }

    void markVisibleAssignedWorkouts();
  }, [assignedWorkouts, user?.id]);

  if (isLoading) {
    return (
      <FullScreenLoader
        title="Loading player view"
        subtitle="Preparing today's plan from your linked pitcher profile and recent workload."
      />
    );
  }

  if (error) {
    return (
      <Screen
        title="Player view unavailable"
        subtitle="This account could not load its linked pitcher profile."
      >
        <SectionCard title="Account">
          <Text style={styles.copy}>{error}</Text>
          <PrimaryButton
            label="Try again"
            onPress={() => {
              setIsLoading(true);
              setError(null);
              setRefreshToken((value) => value + 1);
            }}
            tone="secondary"
          />
        </SectionCard>
      </Screen>
    );
  }

  if (!pitcher) {
    return (
      <Screen
        title="Finish player setup"
        subtitle="This account does not have a linked pitcher profile yet."
      >
        <SectionCard title="Pitcher access">
          <Text style={styles.copy}>
            Complete player setup to create your own pitcher profile, or ask a coach to
            link this account to an existing profile.
          </Text>
          <PrimaryButton
            label="Complete player setup"
            onPress={() => {
              router.push('/player/onboarding');
            }}
          />
        </SectionCard>
      </Screen>
    );
  }

  const recommendation = generateBullpenRecommendation(
    buildBullpenRecommendationInput(pitcher, events)
  );
  const workloadSummary = buildWorkloadSummary(events);
  const lastEvent = workloadSummary.lastThrowingEvent;
  const today = getTodayIsoDateString();
  const todayAssignedWorkout =
    assignedWorkouts.find(
      (workout) => workout.planned_date === today && workout.status !== 'canceled'
    ) ?? null;
  const otherAssignedWorkouts = assignedWorkouts.filter(
    (workout) => !todayAssignedWorkout || workout.id !== todayAssignedWorkout.id
  );

  const todayAssignedWorkoutSyncNote = todayAssignedWorkout
    ? formatAssignedWorkoutSyncNote(todayAssignedWorkout)
    : null;

  return (
    <Screen
      title={formatPitcherName(pitcher)}
      subtitle="Use today's plan as your solo throwing guide, and complete coach-assigned work when it is available."
    >
      <SectionCard title="Profile">
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Development phase</Text>
          <Text style={styles.metricValue}>
            {formatDevelopmentPhaseLabel(pitcher.development_phase)}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Target Game-Ready Date</Text>
          <Text style={styles.metricValue}>
            {pitcher.target_game_ready_date
              ? formatDateLabel(pitcher.target_game_ready_date)
              : 'Not set'}
          </Text>
        </View>
        <Text style={styles.copy}>
          Arsenal:{' '}
          {pitcher.pitch_arsenal.length ? pitcher.pitch_arsenal.join(', ') : 'No arsenal entered'}
        </Text>
      </SectionCard>

      <SectionCard title="Assigned workouts">
        {todayAssignedWorkout ? (
          <View style={styles.assignedWorkoutCard}>
            <Text style={styles.statusLead}>Today’s assigned workout</Text>
            <Text style={styles.assignedWorkoutTitle}>{todayAssignedWorkout.title}</Text>
            <Text style={styles.copy}>
              {formatDateLabel(todayAssignedWorkout.planned_date)} •{' '}
              {formatAssignedWorkoutStatusLabel(todayAssignedWorkout.status)}
            </Text>
            {todayAssignedWorkoutSyncNote ? (
              <Text style={styles.copy}>{todayAssignedWorkoutSyncNote}</Text>
            ) : null}
            <Text style={styles.copy}>
              Focus: {formatAssignedWorkoutFocusLabel(todayAssignedWorkout.focus)} • Intensity:{' '}
              {formatIntensityLabel(todayAssignedWorkout.intensity)}
            </Text>
            <Text style={styles.copy}>
              Target: {formatPitchCountLabel(todayAssignedWorkout.target_pitch_count)}
            </Text>
            <Text style={styles.copy}>Source: Coach assigned</Text>
            {todayAssignedWorkout.coach_notes ? (
              <Text style={styles.copy}>
                Coach notes: {todayAssignedWorkout.coach_notes}
              </Text>
            ) : null}
            {todayAssignedWorkout.status === 'assigned' || todayAssignedWorkout.status === 'viewed' ? (
              <PrimaryButton
                label="Complete assigned workout"
                onPress={() => {
                  router.push({
                    pathname: '/player/log-work',
                    params: { assignedWorkoutId: todayAssignedWorkout.id },
                  });
                }}
              />
            ) : null}
          </View>
        ) : otherAssignedWorkouts.length ? (
          <>
            <Text style={styles.copy}>
              No workout is assigned for today, but you still have coach-assigned work on your schedule.
            </Text>
            {otherAssignedWorkouts.slice(0, 3).map((workout) => (
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
                <Text style={styles.copy}>Source: Coach assigned</Text>
                {formatAssignedWorkoutSyncNote(workout) ? (
                  <Text style={styles.copy}>{formatAssignedWorkoutSyncNote(workout)}</Text>
                ) : null}
                {workout.coach_notes ? (
                  <Text style={styles.copy}>Coach notes: {workout.coach_notes}</Text>
                ) : null}
                {workout.status === 'assigned' || workout.status === 'viewed' ? (
                  <PrimaryButton
                    label="Complete this workout"
                    onPress={() => {
                      router.push({
                        pathname: '/player/log-work',
                        params: { assignedWorkoutId: workout.id },
                      });
                    }}
                    tone="secondary"
                  />
                ) : null}
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.copy}>
            No coach-assigned workouts are on this player account right now.
          </Text>
        )}

        {workoutError ? <Text style={styles.copy}>Assigned workouts are unavailable right now.</Text> : null}
      </SectionCard>

      <SectionCard title="Today's Throwing Plan">
        <Text style={styles.copy}>
          This plan uses your linked profile, recent workload, and arm-feel history to build a conservative throwing recommendation.
        </Text>
        <PrimaryButton
          label="Log completed work"
          onPress={() => {
            router.push('/player/log-work');
          }}
        />
      </SectionCard>

      {recommendation.metadata.plan_state === 'same_day_recovery' ? (
        <SectionCard title="Today’s Status: Throwing Complete">
          <Text style={styles.statusLead}>Today’s Status: Throwing Complete</Text>
          <Text style={styles.copy}>
            You already logged a{' '}
            {recommendation.metadata.same_day_throwing_summary?.event_type
              ? formatEventTypeLabel(
                  recommendation.metadata.same_day_throwing_summary.event_type
                ).toLowerCase()
              : 'throwing session'}{' '}
            today:{' '}
            {formatPitchCountLabel(
              recommendation.metadata.same_day_throwing_summary?.total_pitches ?? null
            )}{' '}
            at{' '}
            {recommendation.metadata.same_day_throwing_summary?.intensity
              ? formatIntensityLabel(
                  recommendation.metadata.same_day_throwing_summary.intensity
                ).toLowerCase()
              : 'logged'}{' '}
            intensity.
          </Text>
          <Text style={styles.statusCallout}>
            No additional throwing is recommended today.
          </Text>
          <Text style={styles.copy}>
            Focus on recovery, mobility, hydration, and arm care.
          </Text>
        </SectionCard>
      ) : null}

      <SectionCard title="Last throwing event">
        {lastEvent ? (
          <>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Date</Text>
              <Text style={styles.metricValue}>{formatDateLabel(lastEvent.date)}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Event type</Text>
              <Text style={styles.metricValue}>
                {formatEventTypeLabel(lastEvent.event_type)}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Pitch count</Text>
              <Text style={styles.metricValue}>
                {formatPitchCountLabel(lastEvent.total_pitches)}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Intensity</Text>
              <Text style={styles.metricValue}>
                {formatIntensityLabel(lastEvent.intensity)}
              </Text>
            </View>
            <Text style={styles.copy}>
              Source: {formatSourceTypeLabel(lastEvent.source_type)}
            </Text>
          </>
        ) : (
          <Text style={styles.copy}>
            No throwing history yet. Log your first session after you complete today’s work.
          </Text>
        )}
      </SectionCard>

      <RecommendationPlanSections
        contextTitle="Today’s plan context"
        recommendation={recommendation}
      />
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
    lineHeight: 21,
    color: colors.muted,
  },
  metricValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  assignedWorkoutCard: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  assignedWorkoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  historyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  historyHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  historyMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  statusLead: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  statusCallout: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.text,
  },
});
