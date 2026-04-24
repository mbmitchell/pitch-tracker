import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import {
  dateToIsoDateString,
  formatIsoDateForDisplay,
  getTodayIsoDateString,
  isoDateStringToDate,
} from '@/utils/dates';
import { colors, radius, spacing } from '@/utils/theme';

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
 * Wraps the native date picker while keeping stored values in ISO format.
 *
 * The UI always shows USA-style dates, but service and database layers keep
 * receiving YYYY-MM-DD strings.
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
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const selectedDate = useMemo(
    () => isoDateStringToDate(value ?? getTodayIsoDateString()),
    [value]
  );

  function openPicker() {
    if (!disabled) {
      setIsPickerOpen(true);
    }
  }

  function closePicker() {
    setIsPickerOpen(false);
  }

  function handleChange(event: DateTimePickerEvent, nextDate?: Date) {
    if (Platform.OS === 'android') {
      closePicker();
    }

    if (event.type === 'dismissed' || !nextDate) {
      return;
    }

    onChange(dateToIsoDateString(nextDate));
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.fieldRow}>
        <Pressable
          accessibilityHint={`Choose ${label}`}
          accessibilityRole="button"
          disabled={disabled}
          onPress={openPicker}
          style={({ pressed }) => [
            styles.field,
            pressed && !disabled ? styles.fieldPressed : null,
            disabled ? styles.fieldDisabled : null,
          ]}
        >
          <Text style={value ? styles.valueText : styles.placeholderText}>
            {value ? formatIsoDateForDisplay(value) : placeholder}
          </Text>
        </Pressable>
        {clearable && value ? (
          <Pressable
            accessibilityHint={`Clear ${label}`}
            accessibilityRole="button"
            onPress={() => onChange(null)}
            style={({ pressed }) => [
              styles.clearButton,
              pressed ? styles.clearButtonPressed : null,
            ]}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      {isPickerOpen ? (
        <View style={styles.pickerCard}>
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            mode="date"
            onChange={handleChange}
            value={selectedDate}
          />
          {Platform.OS === 'ios' ? (
            <View style={styles.pickerActions}>
              {clearable && value ? (
                <Pressable
                  onPress={() => {
                    onChange(null);
                    closePicker();
                  }}
                >
                  <Text style={styles.pickerActionText}>Clear date</Text>
                </Pressable>
              ) : <View />}
              <Pressable onPress={closePicker}>
                <Text style={styles.pickerActionText}>Done</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  fieldPressed: {
    opacity: 0.85,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  valueText: {
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.placeholder,
  },
  clearButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  clearButtonPressed: {
    opacity: 0.8,
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
  pickerCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  pickerActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
