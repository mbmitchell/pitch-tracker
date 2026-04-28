import { StyleSheet, Text, View } from 'react-native';

import { SectionCard } from '@/components/SectionCard';
import {
  BullpenRecommendationOutput,
  BullpenRecommendationWorkBlock,
} from '@/services/recommendations';
import { colors, spacing } from '@/utils/theme';
import {
  formatArmFeelLabel,
  formatBullpenFocusLabel,
  formatDateLabel,
  formatDaysSinceLabel,
  formatDevelopmentPhaseLabel,
  formatEventTypeLabel,
  formatIntensityLabel,
  formatPitchCountLabel,
  formatSuggestedPreseasonPhaseLabel,
  formatTargetGameReadyCountdownLabel,
} from '@/utils/workload';

type RecommendationPlanSectionsProps = {
  recommendation: BullpenRecommendationOutput;
  contextTitle?: string;
};

/** Renders the shared recommendation output sections used in coach and player flows. */
export function RecommendationPlanSections({
  contextTitle = 'Input snapshot',
  recommendation,
}: RecommendationPlanSectionsProps) {
  return (
    <>
      <SectionCard title="Plan summary">
        <View style={styles.priorityRow}>
          <Text style={styles.priorityLabel}>Total pitch count</Text>
          <Text style={styles.priorityValue}>
            {formatPitchCountLabel(recommendation.recommended_total_pitch_count)}
          </Text>
        </View>
        <View style={styles.priorityRow}>
          <Text style={styles.priorityLabel}>Intensity</Text>
          <Text style={styles.priorityValue}>
            {formatIntensityLabel(recommendation.recommended_intensity)}
          </Text>
        </View>
      </SectionCard>

      <SectionCard title="Pitch mix">
        {recommendation.recommended_pitch_mix.length === 0 ? (
          <Text style={styles.detail}>
            • No pitch-specific work is recommended in the current plan.
          </Text>
        ) : (
          recommendation.recommended_pitch_mix.map((item) => (
            <RecommendationBlock
              detail={item.intent}
              key={item.pitch_type}
              title={item.pitch_type}
              value={`${formatPitchCountLabel(item.target_pitches)} (${item.share_percent}%)`}
            />
          ))
        )}
      </SectionCard>

      <SectionCard title="Work blocks">
        {recommendation.recommended_work_blocks.length === 0 ? (
          <Text style={styles.detail}>• No work blocks are defined for the current plan.</Text>
        ) : (
          recommendation.recommended_work_blocks.map((block) => (
            <RecommendationBlock
              detail={block.intent}
              key={block.label}
              title={block.label}
              value={formatPitchCountLabel(block.target_pitches)}
            />
          ))
        )}
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

      <SectionCard title="About the model">
        <View style={styles.contextNote}>
          <Text style={styles.contextNoteText}>
            {recommendation.metadata.about_model_note}
          </Text>
          <Text style={styles.contextSources}>
            Reference points: {recommendation.metadata.supporting_sources.join(' • ')}
          </Text>
        </View>
      </SectionCard>

      <SectionCard title={contextTitle}>
        <RecommendationInputSnapshot recommendation={recommendation} />
      </SectionCard>

      <SectionCard title="Applied rules">
        {recommendation.applied_rules.map((rule) => (
          <Text key={rule} style={styles.detail}>
            • {rule}
          </Text>
        ))}
      </SectionCard>
    </>
  );
}

function RecommendationBlock({
  detail,
  title,
  value,
}: {
  detail: string;
  title: string;
  value: string;
}) {
  return (
    <View style={styles.blockCard}>
      <View style={styles.priorityRow}>
        <Text style={styles.blockTitle}>{title}</Text>
        <Text style={styles.priorityValue}>{value}</Text>
      </View>
      <Text style={styles.detail}>{detail}</Text>
    </View>
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
        Coach-selected phase:{' '}
        {formatDevelopmentPhaseLabel(input.coach_selected_development_phase)}
      </Text>
      <Text style={styles.detail}>
        Recommendation phase: {formatDevelopmentPhaseLabel(input.development_phase)}
      </Text>
      {input.target_game_ready_date ? (
        <>
          <Text style={styles.detail}>
            Target Game-Ready Date: {formatDateLabel(input.target_game_ready_date)}
          </Text>
          {input.suggested_preseason_phase &&
          input.days_until_target_game_ready_date !== null &&
          input.weeks_until_target_game_ready_date !== null ? (
            <>
              <Text style={styles.detail}>
                Suggested preseason phase:{' '}
                {formatSuggestedPreseasonPhaseLabel(input.suggested_preseason_phase)}
              </Text>
              <Text style={styles.detail}>
                Target timeline:{' '}
                {formatTargetGameReadyCountdownLabel({
                  target_date: input.target_game_ready_date,
                  suggested_phase: input.suggested_preseason_phase,
                  days_until_target: input.days_until_target_game_ready_date,
                  weeks_until_target: input.weeks_until_target_game_ready_date,
                })}
              </Text>
            </>
          ) : null}
        </>
      ) : null}
      <Text style={styles.detail}>
        Bullpen focus: {formatBullpenFocusLabel(input.bullpen_focus)}
      </Text>
      <Text style={styles.detail}>
        Days since last throw: {formatDaysSinceLabel(input.days_since_last_throwing_event)}
      </Text>
      <Text style={styles.detail}>
        Days since last high-intensity event:{' '}
        {input.days_since_last_high_intensity_event === null
          ? 'No recent high-intensity event logged'
          : formatDaysSinceLabel(input.days_since_last_high_intensity_event)}
      </Text>
      <Text style={styles.detail}>
        Recent total workload: {formatPitchCountLabel(input.recent_total_workload)}
      </Text>
      <Text style={styles.detail}>
        Last throwing event:{' '}
        {input.last_throwing_event_type
          ? formatEventTypeLabel(input.last_throwing_event_type)
          : 'None'}
      </Text>
      <Text style={styles.detail}>
        Last throwing event pitch count:{' '}
        {formatPitchCountLabel(input.last_throwing_event_pitch_count)}
      </Text>
      <Text style={styles.detail}>
        Last throwing event intensity:{' '}
        {input.last_throwing_event_intensity
          ? formatIntensityLabel(input.last_throwing_event_intensity)
          : 'Not logged'}
      </Text>
      <Text style={styles.detail}>
        Last outing type:{' '}
        {input.last_outing_type ? formatEventTypeLabel(input.last_outing_type) : 'None'}
      </Text>
      <Text style={styles.detail}>Arm feel: {formatArmFeelLabel(input.arm_feel)}</Text>
      <Text style={styles.detail}>
        Recent comparable workload:{' '}
        {input.recent_comparable_workload === null
          ? 'No baseline yet'
          : formatPitchCountLabel(input.recent_comparable_workload)}
      </Text>
      <Text style={styles.detail}>
        Arsenal:{' '}
        {input.pitch_arsenal.length ? input.pitch_arsenal.join(', ') : 'No arsenal entered yet'}
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
  contextNote: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  contextNoteText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  contextSources: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
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
