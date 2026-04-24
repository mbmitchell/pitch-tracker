import { DatePickerField } from '@/components/DatePickerField';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { DevelopmentPhase, Handedness, PitcherProfile } from '@/types/models';
import { colors, spacing } from '@/utils/theme';
import { validatePitcherProfileInput } from '@/utils/validation';

import { OptionChipGroup } from './OptionChipGroup';

import type { PitcherProfileInput } from '@/services/pitchers';

const handednessOptions: Array<{ label: string; value: Handedness }> = [
  { label: 'RHP', value: 'RHP' },
  { label: 'LHP', value: 'LHP' },
  { label: 'Switch', value: 'SWITCH' },
];

const developmentPhaseOptions: Array<{ label: string; value: DevelopmentPhase }> = [
  { label: 'Assessment', value: 'assessment' },
  { label: 'Build', value: 'build' },
  { label: 'Preseason', value: 'preseason' },
  { label: 'In season', value: 'in_season' },
  { label: 'Recovery', value: 'recovery' },
  { label: 'Offseason', value: 'offseason' },
];

const commonPitchOptions = [
  { label: '4-Seam', value: '4-Seam Fastball' },
  { label: '2-Seam', value: '2-Seam Fastball' },
  { label: 'Sinker', value: 'Sinker' },
  { label: 'Cutter', value: 'Cutter' },
  { label: 'Slider', value: 'Slider' },
  { label: 'Curveball', value: 'Curveball' },
  { label: 'Changeup', value: 'Changeup' },
  { label: 'Splitter', value: 'Splitter' },
];

type PitcherProfileFormValues = {
  firstName: string;
  lastName: string;
  age: string;
  grade: string;
  levelTeam: string;
  targetGameReadyDate: string;
  handedness: Handedness | null;
  pitchArsenalText: string;
  developmentPhase: DevelopmentPhase | null;
  primaryGoals: string;
  notes: string;
};

type PitcherProfileFormProps = {
  mode: 'create' | 'edit';
  initialPitcher?: PitcherProfile | null;
  submitError?: string | null;
  isSubmitting?: boolean;
  onSubmit: (input: PitcherProfileInput) => Promise<void> | void;
};

function buildInitialValues(pitcher?: PitcherProfile | null): PitcherProfileFormValues {
  return {
    firstName: pitcher?.first_name ?? '',
    lastName: pitcher?.last_name ?? '',
    age: pitcher?.age ? String(pitcher.age) : '',
    grade: pitcher?.grade ?? '',
    levelTeam: pitcher?.level_team ?? '',
    targetGameReadyDate: pitcher?.target_game_ready_date ?? '',
    handedness: pitcher?.handedness ?? null,
    pitchArsenalText: pitcher?.pitch_arsenal?.join(', ') ?? '',
    developmentPhase: pitcher?.development_phase ?? null,
    primaryGoals: pitcher?.primary_goals ?? '',
    notes: pitcher?.notes ?? '',
  };
}

function normalizePitchArsenal(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function validatePitcherForm(values: PitcherProfileFormValues) {
  return validatePitcherProfileInput(toPitcherProfileInput(values));
}

function toPitcherProfileInput(values: PitcherProfileFormValues): PitcherProfileInput {
  return {
    first_name: values.firstName.trim(),
    last_name: values.lastName.trim(),
    age: values.age.trim() ? Number(values.age) : null,
    grade: values.grade,
    level_team: values.levelTeam,
    target_game_ready_date: values.targetGameReadyDate.trim()
      ? values.targetGameReadyDate.trim()
      : null,
    handedness: values.handedness ?? 'RHP',
    pitch_arsenal: normalizePitchArsenal(values.pitchArsenalText),
    development_phase: values.developmentPhase ?? 'assessment',
    primary_goals: values.primaryGoals,
    notes: values.notes,
  };
}

/**
 * Renders the shared pitcher profile form used for create and edit flows.
 *
 * Validation stays centralized so the create and edit screens behave the same way.
 */
export function PitcherProfileForm({
  initialPitcher,
  isSubmitting = false,
  mode,
  onSubmit,
  submitError,
}: PitcherProfileFormProps) {
  const [values, setValues] = useState<PitcherProfileFormValues>(
    buildInitialValues(initialPitcher)
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValues(buildInitialValues(initialPitcher));
    setValidationError(null);
  }, [initialPitcher]);

  const parsedArsenal = normalizePitchArsenal(values.pitchArsenalText);
  const currentError = validationError ?? submitError;

  async function handleSubmit() {
    const error = validatePitcherForm(values);
    setValidationError(error);

    if (error) {
      return;
    }

    await onSubmit(toPitcherProfileInput(values));
  }

  return (
    <>
      <SectionCard title="Pitcher profile">
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="First name"
              onChangeText={(firstName) => {
                setValues((current) => ({ ...current, firstName }));
                if (currentError) {
                  setValidationError(null);
                }
              }}
              placeholder="Avery"
              value={values.firstName}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Last name"
              onChangeText={(lastName) => {
                setValues((current) => ({ ...current, lastName }));
                if (currentError) {
                  setValidationError(null);
                }
              }}
              placeholder="Brooks"
              value={values.lastName}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              keyboardType="number-pad"
              label="Age"
              onChangeText={(age) => {
                setValues((current) => ({ ...current, age }));
                if (currentError) {
                  setValidationError(null);
                }
              }}
              placeholder="16"
              value={values.age}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Grade"
              onChangeText={(grade) => {
                setValues((current) => ({ ...current, grade }));
              }}
              placeholder="10th"
              value={values.grade}
            />
          </View>
        </View>

        <TextField
          label="Level / team"
          onChangeText={(levelTeam) => {
            setValues((current) => ({ ...current, levelTeam }));
          }}
          placeholder="16U Gold"
          value={values.levelTeam}
        />

        <DatePickerField
          clearable
          helperText="Optional. Used for preseason build-up guidance."
          label="Target Game-Ready Date"
          onChange={(targetGameReadyDate) => {
            setValues((current) => ({
              ...current,
              targetGameReadyDate: targetGameReadyDate ?? '',
            }));
            if (currentError) {
              setValidationError(null);
            }
          }}
          value={values.targetGameReadyDate || null}
        />

        <OptionChipGroup
          label="Handedness"
          onChange={(value) => {
            setValues((current) => ({ ...current, handedness: value as Handedness }));
            if (currentError) {
              setValidationError(null);
            }
          }}
          options={handednessOptions}
          selectedValue={values.handedness}
        />
      </SectionCard>

      <SectionCard title="Development">
        <TextField
          autoCapitalize="words"
          label="Pitch arsenal"
          onChangeText={(pitchArsenalText) => {
            setValues((current) => ({ ...current, pitchArsenalText }));
          }}
          placeholder="4-Seam Fastball, Changeup, Curveball"
          value={values.pitchArsenalText}
        />

        <OptionChipGroup
          label="Quick add pitches"
          multiple
          onChange={(nextValues) => {
            setValues((current) => ({
              ...current,
              pitchArsenalText: Array.isArray(nextValues)
                ? nextValues.join(', ')
                : current.pitchArsenalText,
            }));
          }}
          options={commonPitchOptions}
          selectedValues={parsedArsenal}
        />

        <OptionChipGroup
          label="Development phase"
          onChange={(value) => {
            setValues((current) => ({
              ...current,
              developmentPhase: value as DevelopmentPhase,
            }));
            if (currentError) {
              setValidationError(null);
            }
          }}
          options={developmentPhaseOptions}
          selectedValue={values.developmentPhase}
        />

        <TextField
          label="Primary development goals"
          multiline
          numberOfLines={4}
          onChangeText={(primaryGoals) => {
            setValues((current) => ({ ...current, primaryGoals }));
          }}
          placeholder="Fastball command to glove side, better tempo, improve changeup confidence"
          style={styles.textArea}
          value={values.primaryGoals}
        />

        <TextField
          label="Notes"
          multiline
          numberOfLines={5}
          onChangeText={(notes) => {
            setValues((current) => ({ ...current, notes }));
          }}
          placeholder="Delivery notes, restrictions, communication reminders, parent/coach context..."
          style={styles.textArea}
          value={values.notes}
        />
      </SectionCard>

      {currentError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{currentError}</Text>
        </View>
      ) : null}

      <PrimaryButton
        disabled={isSubmitting}
        label={mode === 'create' ? 'Save pitcher' : 'Save changes'}
        loading={isSubmitting}
        onPress={() => {
          void handleSubmit();
        }}
      />
    </>
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
    minHeight: 112,
    paddingTop: 14,
    textAlignVertical: 'top',
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
