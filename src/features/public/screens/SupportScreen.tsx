import { Href, Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  LinkButton,
  PublicSection,
  PublicSiteLayout,
  SurfaceCard,
} from '@/features/public/components/PublicSiteLayout';
import { colors, spacing } from '@/utils/theme';

const supportTopics = [
  'Account or login issues',
  'Coach and player invites',
  'Data correction requests',
  'Privacy and account requests',
];

const supportEmailHref = 'mailto:support@getpitchready.app' as Href;

export function SupportScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'PitchReady Support' }} />
      <PublicSiteLayout
        activeNav="support"
        introEyebrow="Support"
        introTitle="Get help with PitchReady"
        introSubtitle="We currently handle support requests by email."
      >
        <SurfaceCard subtle>
          <Text style={styles.paragraph}>
            Email support@getpitchready.app with a short description of the issue, the email
            address tied to your account, and any relevant screenshots or steps to reproduce the
            problem.
          </Text>
          <View style={styles.actions}>
            <LinkButton
              href={supportEmailHref}
              label="Email support@getpitchready.app"
            />
          </View>
        </SurfaceCard>

        <PublicSection title="Common support topics">
          <View style={styles.topicList}>
            {supportTopics.map((topic) => (
              <SurfaceCard key={topic}>
                <Text style={styles.topicTitle}>{topic}</Text>
              </SurfaceCard>
            ))}
          </View>
        </PublicSection>

        <PublicSection title="What to include in your request">
          <SurfaceCard>
            <Text style={styles.paragraph}>
              Include the device type, app version if available, and a clear description of the
              issue so we can respond more quickly. For privacy-related requests, note the nature
              of the request in the subject line.
            </Text>
          </SurfaceCard>
        </PublicSection>

        <SurfaceCard>
          <Text style={styles.paragraph}>
            Support email:{' '}
            <Link href={supportEmailHref} style={styles.inlineLink}>
              support@getpitchready.app
            </Link>
          </Text>
        </SurfaceCard>
      </PublicSiteLayout>
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    paddingTop: spacing.xs,
    alignItems: 'flex-start',
  },
  topicList: {
    gap: spacing.md,
  },
  topicTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  paragraph: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 24,
  },
  inlineLink: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'none',
  },
});
