import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { TextField } from '@/components/TextField';
import { DevelopmentPhase, Handedness, PitcherProfile } from '@/types/models';
import { colors, spacing } from '@/utils/theme';

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

function togglePitchArsenalValue(currentValue: string, nextPitch: string) {
  const current = normalizePitchArsenal(currentValue);
  const exists = current.includes(nextPitch);

  const next = exists
    ? current.filter((pitch) => pitch !== nextPitch)
    : [...current, nextPitch];

  return next.join(', ');
}

function validatePitcherForm(values: PitcherProfileFormValues) {
  if (!values.firstName.trim()) {
    return 'First name is required.';
  }

  if (!values.lastName.trim()) {
    return 'Last name is required.';
  }

  if (values.age.trim()) {
    const parsedAge = Number(values.age);

    if (!Number.isInteger(parsedAge) || parsedAge < 5 || parsedAge > 30) {
      return 'Age must be a whole number between 5 and 30.';
    }
  }

  if (!values.handedness) {
    return 'Select a handedness.';
  }

  if (!values.developmentPhase) {
    return 'Select a development phase.';
  }

  return null;
}

function toPitcherProfileInput(values: PitcherProfileFormValues): PitcherProfileInput {
  return {
    first_name: values.firstName.trim(),
    last_name: values.lastName.trim(),
    age: values.age.trim() ? Number(values.age) : null,
    grade: values.grade,
    level_team: values.levelTeam,
    handedness: values.handedness ?? 'RHP',
    pitch_arsenal: normalizePitchArsenal(values.pitchArsenalText),
    development_phase: values.developmentPhase ?? 'assessment',
    primary_goals: values.primaryGoals,
    notes: values.notes,
  };
}

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
