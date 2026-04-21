import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { PitcherProfileForm } from '@/features/pitchers/components/PitcherProfileForm';
import { useAuth } from '@/services/auth';
import { getPitcherByIdForCoach, updatePitcherForCoach } from '@/services/pitchers';
import { formatPitcherName } from '@/services/pitchers';
import { PitcherProfile } from '@/types/models';
import { colors } from '@/utils/theme';

import type { PitcherProfileInput } from '@/services/pitchers';

type EditPitcherScreenProps = {
  pitcherId: string;
};

export function EditPitcherScreen({ pitcherId }: EditPitcherScreenProps) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [pitcher, setPitcher] = useState<PitcherProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
  }, [isFocused, pitcherId, user?.id]);

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
        subtitle="Pulling the latest roster details from Supabase."
      />
    );
  }

  if (loadError || !pitcher) {
    return (
      <Screen title="Pitcher unavailable" subtitle="This roster entry could not be opened.">
        <SectionCard title="Roster">
          <PrimaryButton label="Back to pitchers" onPress={() => router.replace('/pitchers')} />
        </SectionCard>
      </Screen>
    );
  }

  return (
    <Screen
      title={`Edit ${formatPitcherName(pitcher)}`}
      subtitle="Update roster details quickly and keep development context current."
    >
      <PitcherProfileForm
        initialPitcher={pitcher}
        isSubmitting={isSubmitting}
        mode="edit"
        onSubmit={handleUpdatePitcher}
        submitError={submitError}
      />
    </Screen>
  );
}
