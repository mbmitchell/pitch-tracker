import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SectionCard } from '@/components/SectionCard';
import { useAuth } from '@/services/auth';
import { formatPitcherName, listPitchersForCoach } from '@/services/pitchers';
import { PitcherProfile } from '@/types/models';
import { colors, spacing } from '@/utils/theme';
import { formatDevelopmentPhaseLabel } from '@/utils/workload';

function formatArsenal(pitchArsenal: string[]) {
  return pitchArsenal.length ? pitchArsenal.join(', ') : 'No arsenal entered yet';
}

/** Renders the coach-owned pitcher roster for Phase 1. */
export function PitchersScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [pitchers, setPitchers] = useState<PitcherProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadPitchers() {
      if (!user?.id || !isFocused) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await listPitchersForCoach(user.id);
        setPitchers(data);
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : 'Unable to load pitchers.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadPitchers();
  }, [isFocused, refreshToken, user?.id]);

  return (
    <Screen
      title="Pitcher roster"
      subtitle="A coach-first roster view for the pitchers you manage, with quick access to profile details and edits."
    >
      <PrimaryButton label="Add pitcher" onPress={() => router.push('/pitchers/new')} />

      <SectionCard title={`Roster (${pitchers.length})`}>
        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.stateText}>Loading pitcher roster...</Text>
          </View>
        ) : null}

        {!isLoading && error ? (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{error}</Text>
            <PrimaryButton
              label="Try again"
              onPress={() => {
                setIsLoading(true);
                setError(null);
                setRefreshToken((value) => value + 1);
              }}
              tone="secondary"
            />
          </View>
        ) : null}

        {!isLoading && !error && pitchers.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyTitle}>No pitchers yet</Text>
            <Text style={styles.stateText}>
              Add your first pitcher to start tracking roster profiles and workload.
            </Text>
            <PrimaryButton
              label="Create first pitcher"
              onPress={() => router.push('/pitchers/new')}
            />
          </View>
        ) : null}

        {!isLoading && !error
          ? pitchers.map((pitcher) => (
              <Pressable
                key={pitcher.id}
                onPress={() =>
                  router.push({
                    pathname: '/pitchers/[id]',
                    params: { id: pitcher.id },
                  })
                }
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowHeader}>
                  <View style={styles.nameBlock}>
                    <Text style={styles.name}>{formatPitcherName(pitcher)}</Text>
                    <Text style={styles.meta}>
                      {[
                        pitcher.age ? `${pitcher.age} years` : null,
                        pitcher.grade,
                        pitcher.level_team,
                      ]
                        .filter(Boolean)
                        .join(' • ') || 'No age, grade, or team entered yet'}
                    </Text>
                  </View>
                  <Text style={styles.badge}>{pitcher.handedness}</Text>
                </View>

                <Text style={styles.phase}>
                  Phase: {formatDevelopmentPhaseLabel(pitcher.development_phase)}
                </Text>
                <Text style={styles.arsenal}>Arsenal: {formatArsenal(pitcher.pitch_arsenal)}</Text>

                {pitcher.primary_goals ? (
                  <Text numberOfLines={2} style={styles.goals}>
                    Goals: {pitcher.primary_goals}
                  </Text>
                ) : null}
              </Pressable>
            ))
          : null}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  errorState: {
    gap: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  nameBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meta: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  phase: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  arsenal: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  goals: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.8,
  },
});
