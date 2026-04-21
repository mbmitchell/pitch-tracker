import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/Screen';
import { PitcherProfileForm } from '@/features/pitchers/components/PitcherProfileForm';
import { useAuth } from '@/services/auth';
import { createPitcherForCoach } from '@/services/pitchers';

import type { PitcherProfileInput } from '@/services/pitchers';

export function NewPitcherScreen() {
  const router = useRouter();
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
    <Screen
      title="Add pitcher"
      subtitle="Capture the essentials quickly so roster management stays useful during practice and game weeks."
    >
      <PitcherProfileForm
        isSubmitting={isSubmitting}
        mode="create"
        onSubmit={handleCreatePitcher}
        submitError={submitError}
      />
    </Screen>
  );
}
