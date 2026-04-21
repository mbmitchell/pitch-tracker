import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { FullScreenLoader } from '@/components/FullScreenLoader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { useAuth } from '@/services/auth';
import { listThrowingEventsForPitcher, ThrowingEventRecord } from '@/services/events';
import {
  BullpenRecommendationOutput,
  buildBullpenRecommendationInput,
  generateBullpenRecommendation,
} from '@/services/recommendations';
import { PitcherProfile } from '@/types/models';
import { colors, spacing } from '@/utils/theme';
import { formatEventTypeLabel } from '@/utils/workload';

type RecommendationsScreenProps = {
  pitcherId: string;
};

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
  }, [isFocused, pitcherId, user?.id]);

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
            label="Back to pitchers"
            onPress={() => router.replace('/(tabs)/pitchers')}
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
      title={`${pitcher.first_name} ${pitcher.last_name} plan`}
      subtitle="A transparent, rules-based bullpen recommendation built from recent workload and profile context."
    >
      <SectionCard title="Plan summary">
        <View style={styles.priorityRow}>
          <Text style={styles.priorityLabel}>Total pitch count</Text>
          <Text style={styles.priorityValue}>
            {recommendation.recommended_total_pitch_count}
          </Text>
        </View>
        <View style={styles.priorityRow}>
          <Text style={styles.priorityLabel}>Intensity</Text>
          <Text style={styles.priorityValue}>{recommendation.recommended_intensity}</Text>
        </View>
      </SectionCard>

      <SectionCard title="Pitch mix">
        {recommendation.recommended_pitch_mix.map((item) => (
          <View key={item.pitch_type} style={styles.blockCard}>
            <View style={styles.priorityRow}>
              <Text style={styles.blockTitle}>{item.pitch_type}</Text>
              <Text style={styles.priorityValue}>
                {item.target_pitches} pitches ({item.share_percent}%)
              </Text>
            </View>
            <Text style={styles.detail}>{item.intent}</Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Work blocks">
        {recommendation.recommended_work_blocks.map((block) => (
          <View key={block.label} style={styles.blockCard}>
            <View style={styles.priorityRow}>
              <Text style={styles.blockTitle}>{block.label}</Text>
              <Text style={styles.priorityValue}>{block.target_pitches} pitches</Text>
            </View>
            <Text style={styles.detail}>{block.intent}</Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Coaching notes">
        {recommendation.coaching_notes.map((note) => (
          <Text key={note} style={styles.detail}>
            • {note}
          </Text>
        ))}
      </SectionCard>

      <SectionCard title="Caution notes">
        {recommendation.caution_notes.length === 0 ? (
          <Text style={styles.detail}>• No extra caution flags from the current rule set.</Text>
        ) : (
          recommendation.caution_notes.map((note) => (
            <Text key={note} style={styles.detail}>
              • {note}
            </Text>
          ))
        )}
      </SectionCard>

      <SectionCard title="Input snapshot">
        <RecommendationInputSnapshot recommendation={recommendation} />
      </SectionCard>

      <SectionCard title="Applied rules">
        {recommendation.applied_rules.map((rule) => (
          <Text key={rule} style={styles.detail}>
            • {rule}
          </Text>
        ))}
      </SectionCard>
    </Screen>
  );
}

function RecommendationInputSnapshot({
  recommendation,
}: {
  recommendation: BullpenRecommendationOutput;
}) {
  const input = recommendation.input_snapshot;

  return (
    <View style={styles.snapshot}>
      <Text style={styles.detail}>
        Phase: {input.development_phase.replace(/_/g, ' ')}
      </Text>
      <Text style={styles.detail}>
        Bullpen focus: {input.bullpen_focus.replace(/_/g, ' ')}
      </Text>
      <Text style={styles.detail}>
        Days since last throw: {input.days_since_last_throwing_event ?? 'No prior event'}
      </Text>
      <Text style={styles.detail}>
        Days since last high-intensity event:{' '}
        {input.days_since_last_high_intensity_event ?? 'No prior high-intensity event'}
      </Text>
      <Text style={styles.detail}>
        Recent total workload: {input.recent_total_workload}
      </Text>
      <Text style={styles.detail}>
        Last outing type:{' '}
        {input.last_outing_type ? formatEventTypeLabel(input.last_outing_type) : 'None'}
      </Text>
      <Text style={styles.detail}>Arm feel: {input.arm_feel}</Text>
      <Text style={styles.detail}>
        Recent comparable workload: {input.recent_comparable_workload ?? 'No baseline yet'}
      </Text>
      <Text style={styles.detail}>
        Arsenal: {input.pitch_arsenal.length ? input.pitch_arsenal.join(', ') : 'No arsenal entered'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  priorityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  priorityValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  detail: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  blockCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  blockTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  snapshot: {
    gap: spacing.xs,
  },
});
