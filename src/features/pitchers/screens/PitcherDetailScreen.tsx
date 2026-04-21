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
import { formatPitcherName } from '@/services/pitchers';
import { PitcherProfile } from '@/types/models';
import {
  buildWorkloadSummary,
  formatDateLabel,
  formatEventTypeLabel,
  summarizePitchBreakdown,
} from '@/utils/workload';
import { colors, spacing } from '@/utils/theme';

type PitcherDetailScreenProps = {
  pitcherId: string;
};

function formatDevelopmentPhase(value: PitcherProfile['development_phase']) {
  return value.replace('_', ' ');
}

function formatSummaryEventDate(value: ThrowingEventRecord | null) {
  return value ? formatDateLabel(value.date) : 'No event logged';
}

export function PitcherDetailScreen({ pitcherId }: PitcherDetailScreenProps) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [pitcher, setPitcher] = useState<PitcherProfile | null>(null);
  const [events, setEvents] = useState<ThrowingEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPitcherDetail() {
      if (!user?.id || !pitcherId || !isFocused) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await listThrowingEventsForPitcher(user.id, pitcherId, 12);
        setPitcher(result.pitcher);
        setEvents(result.events);
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : 'Unable to load pitcher profile.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPitcherDetail();
  }, [isFocused, pitcherId, user?.id]);

  if (isLoading) {
    return (
      <FullScreenLoader
        title="Loading pitcher"
        subtitle="Pulling this roster profile and recent throwing history from Supabase."
      />
    );
  }

  if (error || !pitcher) {
    return (
      <Screen title="Pitcher unavailable" subtitle="This roster entry could not be opened.">
        <SectionCard title="Roster">
          <Text style={styles.copy}>{error ?? 'Pitcher profile not found.'}</Text>
          <PrimaryButton label="Back to pitchers" onPress={() => router.replace('/pitchers')} />
        </SectionCard>
      </Screen>
    );
  }

  const summary = buildWorkloadSummary(events);

  return (
    <Screen
      title={formatPitcherName(pitcher)}
      subtitle="Coach-owned profile details with recent throwing workload history."
    >
      <SectionCard title="Profile">
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Age</Text>
          <Text style={styles.metricValue}>{pitcher.age ?? 'Not entered'}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Grade</Text>
          <Text style={styles.metricValue}>{pitcher.grade ?? 'Not entered'}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Level / team</Text>
          <Text style={styles.metricValue}>{pitcher.level_team ?? 'Not entered'}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Handedness</Text>
          <Text style={styles.metricValue}>{pitcher.handedness}</Text>
        </View>
      </SectionCard>

      <SectionCard title="Development">
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Phase</Text>
          <Text style={styles.metricValue}>
            {formatDevelopmentPhase(pitcher.development_phase)}
          </Text>
        </View>
        <Text style={styles.copy}>
          Arsenal: {pitcher.pitch_arsenal.length ? pitcher.pitch_arsenal.join(', ') : 'No arsenal entered'}
        </Text>
        <Text style={styles.copy}>
          Goals: {pitcher.primary_goals ?? 'No primary goals entered'}
        </Text>
        <Text style={styles.copy}>Notes: {pitcher.notes ?? 'No notes entered'}</Text>
      </SectionCard>

      <SectionCard title="Workload summary">
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Last bullpen</Text>
          <Text style={styles.metricValue}>{formatSummaryEventDate(summary.lastBullpen)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Last outing</Text>
          <Text style={styles.metricValue}>{formatSummaryEventDate(summary.lastOuting)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Days since last throw</Text>
          <Text style={styles.metricValue}>
            {summary.daysSinceLastThrowingEvent ?? 'No events yet'}
          </Text>
        </View>
      </SectionCard>

      <SectionCard title="Recent throwing history">
        {events.length === 0 ? (
          <>
            <Text style={styles.copy}>
              No throwing events logged yet for this pitcher.
            </Text>
            <PrimaryButton
              label="Add first event"
              onPress={() =>
                router.push({
                  pathname: '/events/new',
                  params: { pitcherId: pitcher.id },
                })
              }
            />
          </>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={styles.historyHeaderCopy}>
                  <Text style={styles.historyTitle}>{formatEventTypeLabel(event.event_type)}</Text>
                  <Text style={styles.historyMeta}>{formatDateLabel(event.date)}</Text>
                </View>
                <Text style={styles.historyMeta}>
                  {event.total_pitches ?? 0} pitches
                </Text>
              </View>
              <Text style={styles.copy}>
                Intensity: {event.intensity} • Arm feel: {event.arm_feel}
              </Text>
              <Text style={styles.copy}>
                Innings: {event.innings_thrown ?? 'N/A'} • Bullpen focus: {event.bullpen_focus ?? 'N/A'}
              </Text>
              <Text style={styles.copy}>
                Breakdown: {summarizePitchBreakdown(event)}
              </Text>
              {event.notes ? <Text style={styles.copy}>Notes: {event.notes}</Text> : null}
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title="Actions">
        <PrimaryButton
          label="Add throwing event"
          onPress={() =>
            router.push({
              pathname: '/events/new',
              params: { pitcherId: pitcher.id },
            })
          }
        />
        <PrimaryButton
          label="Edit pitcher"
          onPress={() =>
            router.push({
              pathname: '/pitchers/[id]/edit',
              params: { id: pitcher.id },
            })
          }
          tone="secondary"
        />
        <PrimaryButton
          label="View recommendations"
          onPress={() =>
            router.push({
              pathname: '/recommendations/[pitcherId]',
              params: { pitcherId: pitcher.id },
            })
          }
          tone="secondary"
        />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metricLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.muted,
  },
  metricValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  historyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  historyHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  historyMeta: {
    fontSize: 13,
    color: colors.muted,
  },
});
