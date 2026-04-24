import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { PitcherProfileForm } from '@/features/pitchers/components/PitcherProfileForm';
import { useAuth } from '@/services/auth';
import { getPitcherByIdForCoach, updatePitcherForCoach } from '@/services/pitchers';
import { formatPitcherName } from '@/services/pitchers';
import { PitcherProfile } from '@/types/models';
import { colors, spacing } from '@/utils/theme';

import type { PitcherProfileInput } from '@/services/pitchers';

type EditPitcherScreenProps = {
  pitcherId: string;
};

/** Renders the edit flow for an existing coach-owned pitcher profile. */
export function EditPitcherScreen({ pitcherId }: EditPitcherScreenProps) {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [pitcher, setPitcher] = useState<PitcherProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadPitcher() {
      if (!user?.id || !pitcherId || !isFocused) {
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const nextPitcher = await getPitcherByIdForCoach(pitcherId, user.id);

        if (!nextPitcher) {
          setPitcher(null);
          setLoadError('Pitcher profile not found.');
          return;
        }

        setPitcher(nextPitcher);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load pitcher profile.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPitcher();
  }, [isFocused, pitcherId, refreshToken, user?.id]);

  async function handleUpdatePitcher(input: PitcherProfileInput) {
    if (!user?.id) {
      setSubmitError('You must be signed in to edit this pitcher.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const updatedPitcher = await updatePitcherForCoach(pitcherId, user.id, input);
      router.replace({
        pathname: '/pitchers/[id]',
        params: { id: updatedPitcher.id },
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save changes.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <FullScreenLoader
        title="Loading pitcher"
        subtitle="Loading the latest roster details for this pitcher."
      />
    );
  }

  if (loadError || !pitcher) {
    return (
      <Screen title="Pitcher unavailable" subtitle="This roster entry could not be opened.">
        <SectionCard title="Roster">
          <Text style={styles.errorText}>{loadError ?? 'Pitcher profile not found.'}</Text>
          <PrimaryButton
            label="Try again"
            onPress={() => {
              setIsLoading(true);
              setLoadError(null);
              setRefreshToken((value) => value + 1);
            }}
            tone="secondary"
          />
          <PrimaryButton label="Back to pitchers" onPress={() => router.replace('/pitchers')} />
        </SectionCard>
      </Screen>
    );
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
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Edit {formatPitcherName(pitcher)}</Text>
            <Text style={styles.subtitle}>
              Update roster details quickly and keep development context current.
            </Text>
          </View>

          <PitcherProfileForm
            initialPitcher={pitcher}
            isSubmitting={isSubmitting}
            mode="edit"
            onSubmit={handleUpdatePitcher}
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
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
