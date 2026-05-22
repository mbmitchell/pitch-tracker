import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  PublicSection,
  PublicSiteLayout,
  SurfaceCard,
} from '@/features/public/components/PublicSiteLayout';
import { colors, spacing } from '@/utils/theme';

const termsSections = [
  {
    title: 'Training tool only',
    body:
      'PitchReady is a training, planning, and workload tracking tool intended to help users record throwing activity, readiness, and related information. It is not a medical device and does not provide medical advice.',
  },
  {
    title: 'No medical advice',
    body:
      'PitchReady does not diagnose, treat, prevent, or cure any condition. Users should seek qualified medical guidance for health concerns, injuries, recovery decisions, or return-to-throw decisions.',
  },
  {
    title: 'Athlete safety remains your responsibility',
    body:
      'Coaches, players, parents, guardians, and organizations remain fully responsible for athlete supervision, training choices, workload decisions, readiness decisions, and overall safety.',
  },
  {
    title: 'Acceptable use',
    body:
      'Users may not misuse the service, interfere with app operations, access accounts without authorization, upload unlawful content, or use PitchReady in a way that violates applicable law or another person’s rights.',
  },
  {
    title: 'Account responsibility',
    body:
      'You are responsible for maintaining the confidentiality of your account credentials and for activity that occurs under your account. Information provided in the app should be accurate to the best of your knowledge.',
  },
  {
    title: 'Limitation of liability',
    body:
      'To the fullest extent permitted by law, PitchReady and Double M Consulting, LLC dba Aerie Solutions are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for decisions made based on app content or tracked information.',
  },
];

export function TermsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'PitchReady Terms of Service' }} />
      <PublicSiteLayout
        activeNav="terms"
        introEyebrow="Terms of Service"
        introTitle="Terms for using PitchReady"
        introSubtitle="Contact: support@getpitchready.app"
      >
        <SurfaceCard subtle>
          <Text style={styles.paragraph}>
            These Terms of Service govern the use of PitchReady. By accessing or using the app,
            you agree to these terms on behalf of yourself and, if applicable, the organization
            you represent.
          </Text>
        </SurfaceCard>

        <View style={styles.group}>
          {termsSections.map((section) => (
            <PublicSection key={section.title} title={section.title}>
              <SurfaceCard>
                <Text style={styles.paragraph}>{section.body}</Text>
              </SurfaceCard>
            </PublicSection>
          ))}
        </View>

        <PublicSection title="Changes and contact">
          <SurfaceCard>
            <Text style={styles.paragraph}>
              We may update these Terms from time to time. Questions about these Terms may be
              sent to support@getpitchready.app.
            </Text>
          </SurfaceCard>
        </PublicSection>
      </PublicSiteLayout>
    </>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.md,
  },
  paragraph: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 24,
  },
});
