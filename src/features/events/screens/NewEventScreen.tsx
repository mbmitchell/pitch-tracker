import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { DatePickerField } from '@/components/DatePickerField';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { OptionChipGroup } from '@/features/pitchers/components/OptionChipGroup';
import { useAuth } from '@/services/auth';
import {
  createThrowingEventForCoach,
  createThrowingEventForPlayer,
  PitchBreakdownInput,
} from '@/services/events';
import {
  formatPitcherName,
  getLinkedPitcherProfileForUser,
  listPitchersForCoach,
} from '@/services/pitchers';
import {
  completeAssignedWorkoutForPlayer,
  getAssignedWorkoutForPlayer,
} from '@/services/workouts';
import {
  ArmFeel,
  AssignedWorkout,
  BullpenFocus,
  EventType,
  Intensity,
  PitcherProfile,
} from '@/types/models';
import { getTodayIsoDateString } from '@/utils/dates';
import { colors, spacing } from '@/utils/theme';
import {
  formatAssignedWorkoutFocusLabel,
  formatAssignedWorkoutStatusLabel,
  formatDateLabel,
  formatIntensityLabel,
  formatPitchCountLabel,
} from '@/utils/workload';
import { validateThrowingEventInput } from '@/utils/validation';

type NewEventScreenProps = {
  initialPitcherId?: string;
  assignedWorkoutId?: string;
  mode?: 'coach' | 'player';
};

type PitchBreakdownRow = {
  id: string;
  pitch_type: string;
  pitch_count: string;
};

const eventTypeOptions: Array<{ label: string; value: EventType }> = [
  { label: 'Bullpen', value: 'bullpen' },
  { label: 'Game outing', value: 'game_outing' },
  { label: 'Live AB', value: 'live_ab' },
  { label: 'Flat ground', value: 'flat_ground' },
  { label: 'Long toss', value: 'long_toss' },
  { label: 'Recovery throw', value: 'recovery_throw' },
  { label: 'Other', value: 'other' },
];

const intensityOptions: Array<{ label: string; value: Intensity }> = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Max', value: 'max' },
];

const armFeelOptions: Array<{ label: string; value: ArmFeel }> = [
  { label: 'Great', value: 'great' },
  { label: 'Good', value: 'good' },
  { label: 'Neutral', value: 'neutral' },
  { label: 'Sore', value: 'sore' },
  { label: 'Pain', value: 'pain' },
];

const bullpenFocusOptions: Array<{ label: string; value: BullpenFocus }> = [
  { label: 'Command', value: 'command' },
  { label: 'Velocity', value: 'velocity' },
  { label: 'Mechanics', value: 'mechanics' },
  { label: 'Secondary', value: 'secondary_pitches' },
  { label: 'Recovery', value: 'recovery' },
  { label: 'Live exec', value: 'live_execution' },
  { label: 'Other', value: 'other' },
];

function createBreakdownRow(): PitchBreakdownRow {
  return {
    id: Math.random().toString(36).slice(2, 10),
    pitch_type: '',
    pitch_count: '',
  };
}

function mapAssignedWorkoutFocusToEventBullpenFocus(
  focus: AssignedWorkout['focus']
): BullpenFocus | null {
  switch (focus) {
    case 'fastball_command':
      return 'command';
    case 'changeup_feel':
    case 'breaking_ball_feel':
      return 'secondary_pitches';
    case 'sequence_work':
    case 'outing_prep':
      return 'live_execution';
    case 'recovery_touch_and_feel':
      return 'recovery';
    default:
      return null;
  }
}

/** Renders the event-entry flow for bullpen, outing, and other throwing work. */
export function NewEventScreen({
  initialPitcherId,
  assignedWorkoutId,
  mode = 'coach',
}: NewEventScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [pitchers, setPitchers] = useState<PitcherProfile[]>([]);
  const [assignedWorkout, setAssignedWorkout] = useState<AssignedWorkout | null>(null);
  const [pitcherFeedback, setPitcherFeedback] = useState('');
  const [isLoadingPitchers, setIsLoadingPitchers] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [selectedPitcherId, setSelectedPitcherId] = useState(initialPitcherId ?? '');
  const [date, setDate] = useState(getTodayIsoDateString());
  const [eventType, setEventType] = useState<EventType | null>('bullpen');
  const [totalPitches, setTotalPitches] = useState('');
  const [inningsThrown, setInningsThrown] = useState('');
  const [intensity, setIntensity] = useState<Intensity | null>('medium');
  const [armFeel, setArmFeel] = useState<ArmFeel | null>('good');
  const [bullpenFocus, setBullpenFocus] = useState<BullpenFocus | null>(null);
  const [notes, setNotes] = useState('');
  const [pitchBreakdown, setPitchBreakdown] = useState<PitchBreakdownRow[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadPitchers() {
      if (!user?.id) {
        return;
      }

      setIsLoadingPitchers(true);
      setLoadingError(null);

      try {
        if (mode === 'player') {
          const linkedPitcher = await getLinkedPitcherProfileForUser(user.id);

          if (!linkedPitcher) {
            setPitchers([]);
            setSelectedPitcherId('');
            setAssignedWorkout(null);
            return;
          }

          let nextAssignedWorkout: AssignedWorkout | null = null;

          if (assignedWorkoutId) {
            nextAssignedWorkout = await getAssignedWorkoutForPlayer(user.id, assignedWorkoutId);

            if (nextAssignedWorkout.status === 'completed') {
              throw new Error('This assigned workout is already marked completed.');
            }

            if (nextAssignedWorkout.status === 'canceled') {
              throw new Error('This assigned workout was canceled and can no longer be completed.');
            }
          }

          setAssignedWorkout(nextAssignedWorkout);
          setPitchers([linkedPitcher]);
          setSelectedPitcherId(linkedPitcher.id);

          if (nextAssignedWorkout) {
            setDate(nextAssignedWorkout.planned_date);
            setEventType('bullpen');
            setTotalPitches(String(nextAssignedWorkout.target_pitch_count));
            setIntensity(nextAssignedWorkout.intensity);
            setBullpenFocus(mapAssignedWorkoutFocusToEventBullpenFocus(nextAssignedWorkout.focus));
            setNotes('');
          }

          return;
        }

        const data = await listPitchersForCoach(user.id);
        setPitchers(data);
        setAssignedWorkout(null);

        if (!selectedPitcherId && data.length === 1) {
          setSelectedPitcherId(data[0].id);
        }
      } catch (error) {
        setLoadingError(
          error instanceof Error
            ? error.message
            : mode === 'player'
              ? 'Unable to load the linked player pitcher profile.'
              : 'Unable to load coach pitchers.'
        );
      } finally {
        setIsLoadingPitchers(false);
      }
    }

    void loadPitchers();
  }, [assignedWorkoutId, mode, refreshToken, selectedPitcherId, user?.id]);

  const pitcherOptions = useMemo(
    () =>
      pitchers.map((pitcher) => ({
        label: formatPitcherName(pitcher),
        value: pitcher.id,
      })),
    [pitchers]
  );

  function normalizePitchBreakdownInput(): PitchBreakdownInput[] {
    return pitchBreakdown
      .map((row) => ({
        pitch_type: row.pitch_type.trim(),
        pitch_count: row.pitch_count.trim() ? Number(row.pitch_count) : NaN,
      }));
  }

  function validateForm() {
    if (!eventType || !intensity || !armFeel) {
      return 'Choose the event type, intensity, and arm-feel rating.';
    }

    if (!totalPitches.trim()) {
      return 'Enter the total pitch count.';
    }

    return validateThrowingEventInput({
      pitcher_id: selectedPitcherId,
      date,
      event_type: eventType,
      total_pitches: Number(totalPitches),
      innings_thrown: inningsThrown.trim() ? Number(inningsThrown) : null,
      intensity,
      arm_feel: armFeel,
      bullpen_focus: bullpenFocus,
      notes,
      source_type: mode === 'player' ? 'player' : 'coach',
      pitch_breakdown: normalizePitchBreakdownInput(),
    });
  }

  async function handleSubmit() {
    const error = validateForm();
    setValidationError(error);
    setSubmitError(null);

    if (error) {
      return;
    }

    if (!user?.id || !eventType || !intensity || !armFeel) {
      setSubmitError('You must be signed in to save a throwing event.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'player' && assignedWorkout) {
        await completeAssignedWorkoutForPlayer(user.id, assignedWorkout.id, {
          pitcher_feedback: pitcherFeedback,
          date,
          event_type: eventType,
          total_pitches: Number(totalPitches),
          innings_thrown: inningsThrown.trim() ? Number(inningsThrown) : null,
          intensity,
          arm_feel: armFeel,
          bullpen_focus: bullpenFocus,
          notes,
          pitch_breakdown: normalizePitchBreakdownInput(),
        });
      } else {
        const createEvent =
          mode === 'player' ? createThrowingEventForPlayer : createThrowingEventForCoach;

        await createEvent(user.id, {
          pitcher_id: selectedPitcherId,
          date,
          event_type: eventType,
          total_pitches: Number(totalPitches),
          innings_thrown: inningsThrown.trim() ? Number(inningsThrown) : null,
          intensity,
          arm_feel: armFeel,
          bullpen_focus: bullpenFocus,
          notes,
          source_type: mode === 'player' ? 'player' : 'coach',
          pitch_breakdown: normalizePitchBreakdownInput(),
        });
      }

      if (mode === 'player') {
        router.replace('/player');
      } else {
        router.replace({
          pathname: '/pitchers/[id]',
          params: { id: selectedPitcherId },
        });
      }
    } catch (nextError) {
      setSubmitError(
        nextError instanceof Error ? nextError.message : 'Unable to save throwing event.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingPitchers) {
    return (
      <FullScreenLoader
        title="Loading pitchers"
        subtitle={
          mode === 'player'
            ? 'Loading your linked pitcher profile for completed-work entry.'
            : 'Getting the coach roster ready for event entry.'
        }
      />
    );
  }

  if (loadingError) {
    return (
      <Screen
        title="Unable to load roster"
        subtitle="The event form needs your roster before it can load."
      >
        <SectionCard title="Roster">
          <Text style={styles.errorText}>{loadingError}</Text>
          <PrimaryButton
            label="Try again"
            onPress={() => {
              setIsLoadingPitchers(true);
              setLoadingError(null);
              setRefreshToken((value) => value + 1);
            }}
            tone="secondary"
          />
          <PrimaryButton
            label="Back to dashboard"
            onPress={() => router.replace(mode === 'player' ? '/player' : '/')}
          />
        </SectionCard>
      </Screen>
    );
  }

  if (!pitchers.length) {
    return (
      <Screen
        title={mode === 'player' ? 'Player setup needed' : 'No pitchers yet'}
        subtitle={
          mode === 'player'
            ? 'Finish player setup before logging completed throwing work.'
            : 'Create a pitcher profile before logging throwing workload.'
        }
      >
        <SectionCard title="Roster">
          <Text style={styles.copy}>
            {mode === 'player'
              ? 'Completed work belongs to the linked pitcher profile, so this account needs a linked pitcher before you can save an event.'
              : 'Events belong to pitcher profiles, so PitchReady needs at least one pitcher on the roster before you can save a throwing event.'}
          </Text>
          <PrimaryButton
            label={mode === 'player' ? 'Go to player setup' : 'Add pitcher'}
            onPress={() =>
              router.replace(mode === 'player' ? '/player/onboarding' : '/pitchers/new')
            }
          />
        </SectionCard>
      </Screen>
    );
  }

  return (
    <Screen
      title={
        mode === 'player'
          ? assignedWorkout
            ? 'Complete assigned workout'
            : 'Log completed work'
          : 'Add throwing event'
      }
      subtitle={
        mode === 'player'
          ? assignedWorkout
            ? 'Complete the assigned workout and record the work you actually threw.'
            : 'Record the work you completed so your recommendation and workload history stay current.'
          : 'Log workload for bullpens, outings, flat grounds, long toss, recovery throws, and more.'
      }
    >
      {assignedWorkout ? (
        <SectionCard title="Assigned workout">
          <Text style={styles.assignmentTitle}>{assignedWorkout.title}</Text>
          <Text style={styles.copy}>
            Planned date: {formatDateLabel(assignedWorkout.planned_date)} • Status:{' '}
            {formatAssignedWorkoutStatusLabel(assignedWorkout.status)}
          </Text>
          <Text style={styles.copy}>
            Focus: {formatAssignedWorkoutFocusLabel(assignedWorkout.focus)} • Intensity:{' '}
            {formatIntensityLabel(assignedWorkout.intensity)}
          </Text>
          <Text style={styles.copy}>
            Target: {formatPitchCountLabel(assignedWorkout.target_pitch_count)}
          </Text>
          <Text style={styles.copy}>Source: Coach assigned</Text>
          {assignedWorkout.coach_notes ? (
            <Text style={styles.copy}>Coach notes: {assignedWorkout.coach_notes}</Text>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard title="Event details">
        {mode === 'coach' ? (
          <OptionChipGroup
            label="Pitcher"
            onChange={(value) => {
              setSelectedPitcherId(value as string);
              setValidationError(null);
            }}
            options={pitcherOptions}
            selectedValue={selectedPitcherId}
          />
        ) : (
          <View style={styles.sourceRow}>
            <Text style={styles.sourceLabel}>Pitcher</Text>
            <Text style={styles.sourceValue}>
              {pitchers[0] ? formatPitcherName(pitchers[0]) : 'Linked profile'}
            </Text>
          </View>
        )}

        <DatePickerField
          helperText="Stored as YYYY-MM-DD internally and shown in MM/DD/YYYY for coaches."
          label="Date"
          onChange={(value) => {
            setDate(value ?? getTodayIsoDateString());
            setValidationError(null);
          }}
          value={date}
        />

        <OptionChipGroup
          label="Event type"
          onChange={(value) => {
            const nextValue = value as EventType;
            setEventType(nextValue);
            if (nextValue !== 'bullpen') {
              setBullpenFocus(null);
            }
            if (nextValue !== 'game_outing') {
              setInningsThrown('');
            }
            setValidationError(null);
          }}
          options={eventTypeOptions}
          selectedValue={eventType}
        />

        {eventType === 'game_outing' ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                keyboardType="number-pad"
                label="Total pitches"
                onChangeText={(value) => {
                  setTotalPitches(value);
                  setValidationError(null);
                }}
                placeholder="42"
                value={totalPitches}
              />
            </View>
            <View style={styles.flex}>
              <TextField
                keyboardType="decimal-pad"
                label="Innings thrown"
                onChangeText={(value) => {
                  setInningsThrown(value);
                  setValidationError(null);
                }}
                placeholder="2.0"
                value={inningsThrown}
              />
            </View>
          </View>
        ) : (
          <TextField
            keyboardType="number-pad"
            label="Total pitches"
            onChangeText={(value) => {
              setTotalPitches(value);
              setValidationError(null);
            }}
            placeholder="42"
            value={totalPitches}
          />
        )}

        <OptionChipGroup
          label="Intensity"
          onChange={(value) => {
            setIntensity(value as Intensity);
            setValidationError(null);
          }}
          options={intensityOptions}
          selectedValue={intensity}
        />

        <OptionChipGroup
          label="Arm feel"
          onChange={(value) => {
            setArmFeel(value as ArmFeel);
            setValidationError(null);
          }}
          options={armFeelOptions}
          selectedValue={armFeel}
        />

        {eventType === 'bullpen' ? (
          <OptionChipGroup
            label="Bullpen focus"
            onChange={(value) => {
              const nextValue = value as BullpenFocus;
              setBullpenFocus((current) => (current === nextValue ? null : nextValue));
            }}
            options={bullpenFocusOptions}
            selectedValue={bullpenFocus}
          />
        ) : null}

        <TextField
          label="Notes"
          multiline
          numberOfLines={5}
          onChangeText={setNotes}
          placeholder="Intent, pitch quality, recovery notes, opponent context, or coaching reminders..."
          style={styles.textArea}
          value={notes}
        />

        {assignedWorkout ? (
          <TextField
            label="Pitcher feedback"
            multiline
            numberOfLines={4}
            onChangeText={setPitcherFeedback}
            placeholder="How did the workout feel? What went well? Any recovery or arm-care notes for the coach?"
            style={styles.feedbackArea}
            value={pitcherFeedback}
          />
        ) : null}

        <View style={styles.sourceRow}>
          <Text style={styles.sourceLabel}>Source type</Text>
          <Text style={styles.sourceValue}>{mode === 'player' ? 'player' : 'coach'}</Text>
        </View>
      </SectionCard>

      <SectionCard title="Optional pitch breakdown">
        {pitchBreakdown.length === 0 ? (
          <Text style={styles.copy}>
            Add pitch types and counts if you want more detailed workload records.
          </Text>
        ) : null}

        {pitchBreakdown.map((row) => (
          <View key={row.id} style={styles.breakdownRow}>
            <View style={styles.breakdownFields}>
              <View style={styles.flex}>
                <TextField
                  label="Pitch type"
                  onChangeText={(value) => {
                    setPitchBreakdown((current) =>
                      current.map((item) =>
                        item.id === row.id ? { ...item, pitch_type: value } : item
                      )
                    );
                    setValidationError(null);
                  }}
                  placeholder="Slider"
                  value={row.pitch_type}
                />
              </View>
              <View style={styles.breakdownCount}>
                <TextField
                  keyboardType="number-pad"
                  label="Count"
                  onChangeText={(value) => {
                    setPitchBreakdown((current) =>
                      current.map((item) =>
                        item.id === row.id ? { ...item, pitch_count: value } : item
                      )
                    );
                    setValidationError(null);
                  }}
                  placeholder="12"
                  value={row.pitch_count}
                />
              </View>
            </View>
            <Pressable
              onPress={() => {
                setPitchBreakdown((current) => current.filter((item) => item.id !== row.id));
              }}
              style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
            >
              <Text style={styles.removeButtonText}>Remove row</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={() => {
            setPitchBreakdown((current) => [...current, createBreakdownRow()]);
            setValidationError(null);
          }}
          style={({ pressed }) => [styles.addRowButton, pressed && styles.pressed]}
        >
          <Text style={styles.addRowButtonText}>Add pitch breakdown row</Text>
        </Pressable>
      </SectionCard>

      {validationError || submitError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{validationError ?? submitError}</Text>
        </View>
      ) : null}

      <PrimaryButton
        disabled={isSubmitting}
        label={assignedWorkout ? 'Complete workout' : 'Save throwing event'}
        loading={isSubmitting}
        onPress={() => {
          void handleSubmit();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  feedbackArea: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  sourceLabel: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '600',
  },
  sourceValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  breakdownRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  breakdownFields: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  breakdownCount: {
    width: 104,
  },
  addRowButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  addRowButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  removeButton: {
    alignSelf: 'flex-start',
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
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
  pressed: {
    opacity: 0.7,
  },
});
