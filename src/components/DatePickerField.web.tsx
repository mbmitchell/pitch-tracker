import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/TextField';
import {
  formatIsoDateForDisplay,
  parseUsDateStringToIso,
} from '@/utils/dates';
import { colors, spacing } from '@/utils/theme';

type DatePickerFieldProps = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
  clearable?: boolean;
};

/**
 * Web-safe fallback for the shared date field.
 *
 * Native platforms use the actual picker control; web keeps the same ISO
 * storage contract while accepting MM/DD/YYYY text input.
 */
export function DatePickerField({
  clearable = false,
  disabled = false,
  helperText,
  label,
  onChange,
  placeholder = 'MM/DD/YYYY',
  value,
}: DatePickerFieldProps) {
  const [displayValue, setDisplayValue] = useState(
    value ? formatIsoDateForDisplay(value) : ''
  );

  useEffect(() => {
    setDisplayValue(value ? formatIsoDateForDisplay(value) : '');
  }, [value]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.field}>
          <TextField
            autoCapitalize="none"
            editable={!disabled}
            keyboardType="numbers-and-punctuation"
            label={label}
            onBlur={() => {
              if (!displayValue.trim()) {
                onChange(null);
                return;
              }

              const isoDate = parseUsDateStringToIso(displayValue);

              if (isoDate) {
                onChange(isoDate);
                setDisplayValue(formatIsoDateForDisplay(isoDate));
              }
            }}
            onChangeText={setDisplayValue}
            placeholder={placeholder}
            value={displayValue}
          />
        </View>
        {clearable && value ? (
          <Pressable onPress={() => onChange(null)} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
  },
  clearButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
});
