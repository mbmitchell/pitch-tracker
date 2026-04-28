import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { useAuth } from '@/services/auth';
import { RecommendationPlanSections } from '@/features/recommendations/components/RecommendationPlanSections';
import { listThrowingEventsForPitcher, ThrowingEventRecord } from '@/services/events';
import {
  buildBullpenRecommendationInput,
  generateBullpenRecommendation,
} from '@/services/recommendations';
import { formatPitcherName } from '@/services/pitchers';
import { PitcherProfile } from '@/types/models';
import { colors } from '@/utils/theme';

type RecommendationsScreenProps = {
  pitcherId: string;
};

/** Renders the bullpen recommendation experience for one pitcher. */
export function RecommendationsScreen({
  pitcherId,
}: RecommendationsScreenProps) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [pitcher, setPitcher] = useState<PitcherProfile | null>(null);
  const [events, setEvents] = useState<ThrowingEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadPitcherRecommendations() {
      if (!user?.id || !pitcherId || !isFocused) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await listThrowingEventsForPitcher(user.id, pitcherId, 12);

        if (!result.pitcher) {
          setPitcher(null);
          setError('Pitcher profile not found.');
          return;
        }

        setPitcher(result.pitcher);
        setEvents(result.events);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to load pitcher recommendations.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPitcherRecommendations();
  }, [isFocused, pitcherId, refreshToken, user?.id]);

  if (isLoading) {
    return (
      <FullScreenLoader
        title="Loading recommendations"
        subtitle="Preparing a deterministic bullpen plan from recent workload."
      />
    );
  }

  if (error || !pitcher) {
    return (
      <Screen
        title="Recommendations unavailable"
        subtitle="Pick a pitcher first so the app has some starter context."
      >
        <SectionCard title="Roster">
          <Text style={styles.detail}>{error ?? 'Pitcher profile not found.'}</Text>
          <PrimaryButton
            label="Try again"
            onPress={() => {
              setIsLoading(true);
              setError(null);
              setRefreshToken((value) => value + 1);
            }}
            tone="secondary"
          />
          <PrimaryButton
            label="Back to pitchers"
            onPress={() => router.replace('/pitchers')}
          />
        </SectionCard>
      </Screen>
    );
  }

  const recommendation = generateBullpenRecommendation(
    buildBullpenRecommendationInput(pitcher, events)
  );

  return (
    <Screen
      title={`${formatPitcherName(pitcher)} plan`}
      subtitle="A transparent, rules-based bullpen recommendation built from recent workload and profile context."
    >
      <RecommendationPlanSections recommendation={recommendation} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  detail: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
});
