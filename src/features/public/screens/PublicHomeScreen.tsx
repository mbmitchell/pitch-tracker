import { Href, Link, Stack } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  LinkButton,
  PublicSection,
  PublicSiteLayout,
  SurfaceCard,
} from '@/features/public/components/PublicSiteLayout';
import { colors, radius, spacing } from '@/utils/theme';

const privacyHref = '/privacy' as Href;
const termsHref = '/terms' as Href;
const supportHref = '/support' as Href;

const featureCards = [
  {
    title: 'Throwing workload tracking',
    body:
      'Capture throwing events, bullpen sessions, recovery work, and daily readiness in one mobile-first workflow.',
  },
  {
    title: 'Coach and player coordination',
    body:
      'Support staff oversight and player updates with shared views for planning, accountability, and follow-up.',
  },
  {
    title: 'Offline-friendly by design',
    body:
      'Keep important workload details close at hand when practice settings, travel, or facility connectivity are inconsistent.',
  },
];

const workflowCards = [
  {
    title: 'For coaches',
    body:
      'Monitor pitcher status, plan bullpens, assign throwing work, and keep a clearer picture of readiness across the staff.',
  },
  {
    title: 'For players',
    body:
      'Log completed work, track recovery signals, and maintain a simple record of how the arm has been used over time.',
  },
];

export function PublicHomeScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 920;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'PitchReady' }} />
      <PublicSiteLayout
        activeNav="home"
        hero={
          <View style={[styles.hero, isWide && styles.heroWide]}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Pitcher workload and readiness tracking</Text>
              <Text style={styles.headline}>
                PitchReady helps pitchers, coaches, and players manage throwing workload,
                bullpen activity, recovery, and readiness in one mobile-first workflow.
              </Text>
              <Text style={styles.heroText}>
                Built for real coach and player workflows, PitchReady keeps training context in
                one place so teams can log work, review status, and stay aligned session to
                session, including in offline-friendly environments.
              </Text>

              <View style={[styles.ctaRow, !isWide && styles.ctaColumn]}>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonLabel}>Coming soon on the App Store</Text>
                </View>
                <LinkButton href={supportHref} label="Contact support" tone="secondary" />
              </View>
            </View>

            <View style={styles.heroPanel}>
              <SurfaceCard subtle>
                <Text style={styles.panelEyebrow}>What PitchReady focuses on</Text>
                <View style={styles.panelList}>
                  <Text style={styles.panelItem}>Throwing event tracking</Text>
                  <Text style={styles.panelItem}>Bullpen planning and follow-through</Text>
                  <Text style={styles.panelItem}>Recovery and readiness check-ins</Text>
                  <Text style={styles.panelItem}>Coach-to-player workload visibility</Text>
                </View>
              </SurfaceCard>
            </View>
          </View>
        }
      >
        <PublicSection title="Track the work that matters">
          <View style={[styles.cardGrid, isWide && styles.cardGridWide]}>
            {featureCards.map((card) => (
              <SurfaceCard key={card.title}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardBody}>{card.body}</Text>
              </SurfaceCard>
            ))}
          </View>
        </PublicSection>

        <PublicSection title="Designed around staff and athlete workflows">
          <View style={[styles.cardGrid, isWide && styles.twoUpGrid]}>
            {workflowCards.map((card) => (
              <SurfaceCard key={card.title} subtle>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardBody}>{card.body}</Text>
              </SurfaceCard>
            ))}
          </View>
        </PublicSection>

        <SurfaceCard>
          <Text style={styles.cardTitle}>Review-ready essentials</Text>
          <Text style={styles.cardBody}>
            PitchReady is operated by Double M Consulting, LLC dba Aerie Solutions. Public
            support, privacy, and terms information is available below for App Store review and
            launch readiness.
          </Text>
          <View style={styles.linkRow}>
            <Link href={privacyHref} style={styles.inlineLink}>
              Privacy Policy
            </Link>
            <Link href={termsHref} style={styles.inlineLink}>
              Terms of Service
            </Link>
            <Link href={supportHref} style={styles.inlineLink}>
              Support
            </Link>
          </View>
        </SurfaceCard>
      </PublicSiteLayout>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroCopy: {
    flex: 1.5,
    gap: spacing.md,
  },
  heroPanel: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headline: {
    color: colors.text,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  heroText: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 640,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  ctaColumn: {
    alignItems: 'flex-start',
  },
  comingSoonBadge: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#DDEBFA',
    justifyContent: 'center',
  },
  comingSoonLabel: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  panelEyebrow: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  panelList: {
    gap: spacing.sm,
  },
  panelItem: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D9E6F2',
  },
  cardGrid: {
    gap: spacing.md,
  },
  cardGridWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  twoUpGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  cardBody: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  inlineLink: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'none',
  },
});
