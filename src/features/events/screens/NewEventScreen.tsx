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
import { createThrowingEventForCoach, PitchBreakdownInput } from '@/services/events';
import { formatPitcherName, listPitchersForCoach } from '@/services/pitchers';
import {
  ArmFeel,
  BullpenFocus,
  EventType,
  Intensity,
  PitcherProfile,
} from '@/types/models';
import { getTodayIsoDateString } from '@/utils/dates';
import { colors, spacing } from '@/utils/theme';
import { validateThrowingEventInput } from '@/utils/validation';

type NewEventScreenProps = {
  initialPitcherId?: string;
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

/** Renders the event-entry flow for bullpen, outing, and other throwing work. */
export function NewEventScreen({ initialPitcherId }: NewEventScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [pitchers, setPitchers] = useState<PitcherProfile[]>([]);
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
        const data = await listPitchersForCoach(user.id);
        setPitchers(data);

        if (!selectedPitcherId && data.length === 1) {
          setSelectedPitcherId(data[0].id);
        }
      } catch (error) {
        setLoadingError(
          error instanceof Error ? error.message : 'Unable to load coach pitchers.'
        );
      } finally {
        setIsLoadingPitchers(false);
      }
    }

    void loadPitchers();
  }, [refreshToken, selectedPitcherId, user?.id]);

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
      source_type: 'coach',
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
      await createThrowingEventForCoach(user.id, {
        pitcher_id: selectedPitcherId,
        date,
        event_type: eventType,
        total_pitches: Number(totalPitches),
        innings_thrown: inningsThrown.trim() ? Number(inningsThrown) : null,
        intensity,
        arm_feel: armFeel,
        bullpen_focus: bullpenFocus,
        notes,
        source_type: 'coach',
        pitch_breakdown: normalizePitchBreakdownInput(),
      });

      router.replace({
        pathname: '/pitchers/[id]',
        params: { id: selectedPitcherId },
      });
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
        subtitle="Getting the coach roster ready for event entry."
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
            onPress={() => router.replace('/')}
          />
        </SectionCard>
      </Screen>
    );
  }

  if (!pitchers.length) {
    return (
      <Screen
        title="No pitchers yet"
        subtitle="Create a pitcher profile before logging throwing workload."
      >
        <SectionCard title="Roster">
          <Text style={styles.copy}>
            Events belong to pitcher profiles, so Bullpen Planner needs at least one
            pitcher on the roster before you can save a throwing event.
          </Text>
          <PrimaryButton label="Add pitcher" onPress={() => router.replace('/pitchers/new')} />
        </SectionCard>
      </Screen>
    );
  }

  return (
    <Screen
      title="Add throwing event"
      subtitle="Log workload for bullpens, outings, flat grounds, long toss, recovery throws, and more."
    >
      <SectionCard title="Event details">
        <OptionChipGroup
          label="Pitcher"
          onChange={(value) => {
            setSelectedPitcherId(value as string);
            setValidationError(null);
          }}
          options={pitcherOptions}
          selectedValue={selectedPitcherId}
        />

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

        <View style={styles.sourceRow}>
          <Text style={styles.sourceLabel}>Source type</Text>
          <Text style={styles.sourceValue}>coach</Text>
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
        label="Save throwing event"
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
