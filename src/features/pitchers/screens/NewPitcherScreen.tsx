import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useHeaderHeight } from '@react-navigation/elements';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PitcherProfileForm } from '@/features/pitchers/components/PitcherProfileForm';
import { useAuth } from '@/services/auth';
import { createPitcherForCoach } from '@/services/pitchers';
import { colors, spacing } from '@/utils/theme';

import type { PitcherProfileInput } from '@/services/pitchers';

/** Renders the create flow for a new coach-owned pitcher profile. */
export function NewPitcherScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleCreatePitcher(input: PitcherProfileInput) {
    if (!user?.id) {
      setSubmitError('You must be signed in to create a pitcher profile.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const createdPitcher = await createPitcherForCoach(user.id, input);
      router.replace({
        pathname: '/pitchers/[id]',
        params: { id: createdPitcher.id },
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save pitcher.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
        style={styles.flex}
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          style={styles.flex}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Add pitcher</Text>
            <Text style={styles.subtitle}>
              Capture the essentials quickly so roster management stays useful during
              practice and game weeks.
            </Text>
          </View>

          <PitcherProfileForm
            isSubmitting={isSubmitting}
            mode="create"
            onSubmit={handleCreatePitcher}
            submitError={submitError}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 48,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
});
