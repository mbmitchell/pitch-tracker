import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { DatePickerField } from '@/components/DatePickerField';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { OptionChipGroup } from '@/features/pitchers/components/OptionChipGroup';
import { RecommendationPlanSections } from '@/features/recommendations/components/RecommendationPlanSections';
import { useAuth } from '@/services/auth';
import { listThrowingEventsForPitcher } from '@/services/events';
import {
  formatPitcherName,
  getPitcherByIdForCoach,
  getPitcherProfileLinkStatusForCoach,
} from '@/services/pitchers';
import {
  buildAssignedWorkoutDraftFromRecommendation,
  createAssignedWorkoutForCoach,
} from '@/services/workouts';
import {
  buildAssignedWorkoutPlanDetails,
  buildBullpenRecommendationInput,
  generateBullpenRecommendation,
  RecommendationBullpenFocus,
} from '@/services/recommendations';
import { Intensity, PitcherProfile } from '@/types/models';
import { getTodayIsoDateString } from '@/utils/dates';
import { colors, spacing } from '@/utils/theme';
import {
  formatAssignedWorkoutFocusLabel,
  formatIntensityLabel,
  formatPitchCountLabel,
} from '@/utils/workload';

type AssignWorkoutScreenProps = {
  pitcherId: string;
};

const focusOptions: Array<{ label: string; value: RecommendationBullpenFocus }> = [
  { label: 'FB command', value: 'fastball_command' },
  { label: 'CH feel', value: 'changeup_feel' },
  { label: 'BB feel', value: 'breaking_ball_feel' },
  { label: 'Sequence', value: 'sequence_work' },
  { label: 'Recovery', value: 'recovery_touch_and_feel' },
  { label: 'Outing prep', value: 'outing_prep' },
];

const intensityOptions: Array<{ label: string; value: Intensity }> = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Max', value: 'max' },
];

/** Builds and saves a coach-assigned workout from the current recommendation context. */
export function AssignWorkoutScreen({ pitcherId }: AssignWorkoutScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [pitcher, setPitcher] = useState<PitcherProfile | null>(null);
  const [recommendedSummary, setRecommendedSummary] = useState<ReturnType<typeof generateBullpenRecommendation> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [plannedDate, setPlannedDate] = useState(getTodayIsoDateString());
  const [focus, setFocus] = useState<RecommendationBullpenFocus>('fastball_command');
  const [targetPitchCount, setTargetPitchCount] = useState('');
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [coachNotes, setCoachNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadWorkoutDraft() {
      if (!user?.id) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const basePitcher = await getPitcherByIdForCoach(pitcherId, user.id);

        if (!basePitcher) {
          throw new Error('Pitcher profile not found for this coach.');
        }

        const linkedStatus = await getPitcherProfileLinkStatusForCoach(user.id, pitcherId);

        if (!linkedStatus) {
          throw new Error('Link a player account before assigning workouts to this pitcher.');
        }

        const history = await listThrowingEventsForPitcher(user.id, pitcherId, 12);
        const recommendation = generateBullpenRecommendation(
          buildBullpenRecommendationInput(history.pitcher, history.events)
        );
        const draft = buildAssignedWorkoutDraftFromRecommendation(
          history.pitcher,
          recommendation,
          getTodayIsoDateString()
        );

        setPitcher(history.pitcher);
        setRecommendedSummary(recommendation);
        setTitle(draft.title);
        setPlannedDate(draft.planned_date);
        setFocus(draft.focus);
        setTargetPitchCount(String(draft.target_pitch_count));
        setIntensity(draft.intensity);
        setCoachNotes(draft.coach_notes ?? '');
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to prepare an assigned workout.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadWorkoutDraft();
  }, [pitcherId, refreshToken, user?.id]);

  const planDetails = useMemo(() => {
    if (!pitcher) {
      return null;
    }

    const numericPitchCount = Number(targetPitchCount);

    if (!Number.isFinite(numericPitchCount) || numericPitchCount < 0) {
      return null;
    }

    return buildAssignedWorkoutPlanDetails(
      Math.round(numericPitchCount),
      focus,
      pitcher.pitch_arsenal
    );
  }, [focus, pitcher, targetPitchCount]);

  async function handleSubmit() {
    if (!user?.id || !pitcher) {
      return;
    }

    setSubmitError(null);

    if (!title.trim()) {
      setSubmitError('Workout title is required.');
      return;
    }

    if (!targetPitchCount.trim()) {
      setSubmitError('Enter a target pitch count.');
      return;
    }

    const numericPitchCount = Number(targetPitchCount);

    if (!Number.isInteger(numericPitchCount) || numericPitchCount < 0) {
      setSubmitError('Target pitch count must be a whole number of 0 or greater.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createAssignedWorkoutForCoach(user.id, {
        pitcher_id: pitcher.id,
        planned_date: plannedDate,
        title,
        focus,
        target_pitch_count: numericPitchCount,
        intensity,
        pitch_mix: planDetails?.pitch_mix ?? [],
        work_blocks: planDetails?.work_blocks ?? [],
        coach_notes: coachNotes,
      });

      router.replace({
        pathname: '/pitchers/[id]',
        params: { id: pitcher.id },
      });
    } catch (nextError) {
      setSubmitError(
        nextError instanceof Error
          ? nextError.message
          : 'Unable to assign the workout.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <FullScreenLoader
        title="Preparing workout"
        subtitle="Building a coach-assigned workout from the current recommendation."
      />
    );
  }

  if (error || !pitcher || !recommendedSummary) {
    return (
      <Screen
        title="Workout unavailable"
        subtitle="This assigned workout draft could not be prepared."
      >
        <SectionCard title="Assignment">
          <Text style={styles.copy}>{error ?? 'Pitcher profile not found.'}</Text>
          <PrimaryButton
            label="Try again"
            onPress={() => {
              setRefreshToken((value) => value + 1);
            }}
            tone="secondary"
          />
          <PrimaryButton
            label="Back to pitcher"
            onPress={() =>
              router.replace({
                pathname: '/pitchers/[id]',
                params: { id: pitcherId },
              })
            }
          />
        </SectionCard>
      </Screen>
    );
  }

  return (
    <Screen
      title="Assign workout"
      subtitle={`Build a throwing workout for ${formatPitcherName(pitcher)} from the current recommendation and adjust the practical details before sending it.`}
    >
      <SectionCard title="Assignment details">
        <TextField
          label="Workout title"
          onChangeText={(value) => {
            setTitle(value);
            setSubmitError(null);
          }}
          placeholder="Tuesday throwing plan"
          value={title}
        />

        <DatePickerField
          label="Planned date"
          onChange={(value) => {
            setPlannedDate(value ?? getTodayIsoDateString());
            setSubmitError(null);
          }}
          value={plannedDate}
        />

        <OptionChipGroup
          label="Focus"
          onChange={(value) => {
            setFocus(value as RecommendationBullpenFocus);
            setSubmitError(null);
          }}
          options={focusOptions}
          selectedValue={focus}
        />

        <TextField
          keyboardType="number-pad"
          label="Target pitch count"
          onChangeText={(value) => {
            setTargetPitchCount(value);
            setSubmitError(null);
          }}
          placeholder="35"
          value={targetPitchCount}
        />

        <OptionChipGroup
          label="Intensity"
          onChange={(value) => {
            setIntensity(value as Intensity);
            setSubmitError(null);
          }}
          options={intensityOptions}
          selectedValue={intensity}
        />

        <TextField
          label="Coach notes"
          multiline
          numberOfLines={5}
          onChangeText={(value) => {
            setCoachNotes(value);
            setSubmitError(null);
          }}
          placeholder="Execution reminders, intent cues, or extra context for the player..."
          style={styles.textArea}
          value={coachNotes}
        />
      </SectionCard>

      <SectionCard title="Workout preview">
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Focus</Text>
          <Text style={styles.metricValue}>{formatAssignedWorkoutFocusLabel(focus)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Pitch count</Text>
          <Text style={styles.metricValue}>
            {formatPitchCountLabel(targetPitchCount.trim() ? Number(targetPitchCount) : null)}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Intensity</Text>
          <Text style={styles.metricValue}>{formatIntensityLabel(intensity)}</Text>
        </View>
        <Text style={styles.copy}>Source: Coach assigned</Text>
        {planDetails?.pitch_mix.length ? (
          <Text style={styles.copy}>
            Pitch mix: {planDetails.pitch_mix.map((item) => `${item.pitch_type} ${item.target_pitches}`).join(' • ')}
          </Text>
        ) : (
          <Text style={styles.copy}>
            Pitch mix will stay simple until a valid pitch count is entered.
          </Text>
        )}
      </SectionCard>

      <RecommendationPlanSections
        contextTitle="Recommendation source"
        recommendation={recommendedSummary}
      />

      {submitError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      ) : null}

      <PrimaryButton
        disabled={isSubmitting}
        label="Assign workout"
        loading={isSubmitting}
        onPress={() => {
          void handleSubmit();
        }}
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
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'right',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
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
});
