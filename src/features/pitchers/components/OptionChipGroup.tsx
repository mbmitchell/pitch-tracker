import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/utils/theme';

type OptionChip = {
  label: string;
  value: string;
};

type OptionChipGroupProps = {
  label: string;
  options: OptionChip[];
  selectedValue?: string | null;
  selectedValues?: string[];
  multiple?: boolean;
  onChange: (value: string | string[]) => void;
};

/** Renders a compact chip-based selector used throughout pitcher and event forms. */
export function OptionChipGroup({
  label,
  multiple = false,
  onChange,
  options,
  selectedValue,
  selectedValues = [],
}: OptionChipGroupProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const isSelected = multiple
            ? selectedValues.includes(option.value)
            : selectedValue === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => {
                if (multiple) {
                  const nextValues = isSelected
                    ? selectedValues.filter((value) => value !== option.value)
                    : [...selectedValues, option.value];
                  onChange(nextValues);
                  return;
                }

                onChange(option.value);
              }}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.selectedChip,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipLabel, isSelected && styles.selectedChipLabel]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedChip: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedChipLabel: {
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
