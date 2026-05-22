import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  PublicSection,
  PublicSiteLayout,
  SurfaceCard,
} from '@/features/public/components/PublicSiteLayout';
import { colors, spacing } from '@/utils/theme';

const dataTypes = [
  {
    title: 'Account information',
    body:
      'We may collect details such as your name, email address, account role, and login information needed to create and maintain your PitchReady account.',
  },
  {
    title: 'Throwing and workload data',
    body:
      'We may collect throwing-event records, bullpen activity, recovery notes, readiness check-ins, assigned work, and related training details entered in the app.',
  },
  {
    title: 'Coach and player relationship data',
    body:
      'We may collect staff, athlete, roster, and invite relationship information so coaches and players can connect and share the right workload views.',
  },
  {
    title: 'Device and diagnostic data',
    body:
      'We may receive device type, operating system, app version, crash logs, and other diagnostic information when needed to maintain app reliability and support users.',
  },
];

export function PrivacyPolicyScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'PitchReady Privacy Policy' }} />
      <PublicSiteLayout
        activeNav="privacy"
        introEyebrow="Privacy Policy"
        introTitle="How PitchReady handles information"
        introSubtitle="Effective date: [Effective Date]"
      >
        <SurfaceCard subtle>
          <Text style={styles.paragraph}>
            PitchReady is operated by Double M Consulting, LLC dba Aerie Solutions. This Privacy
            Policy explains the categories of information we may collect, how we use that
            information, and the choices available to users of PitchReady.
          </Text>
        </SurfaceCard>

        <PublicSection title="Information we may collect">
          <View style={styles.group}>
            {dataTypes.map((item) => (
              <SurfaceCard key={item.title}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.paragraph}>{item.body}</Text>
              </SurfaceCard>
            ))}
          </View>
        </PublicSection>

        <PublicSection title="How we use information">
          <SurfaceCard>
            <Text style={styles.paragraph}>
              PitchReady uses collected information to operate the app, maintain accounts,
              support coach and player workflows, store and display workload and readiness
              information, troubleshoot issues, improve reliability, and respond to support or
              privacy requests.
            </Text>
          </SurfaceCard>
        </PublicSection>

        <PublicSection title="How we share information">
          <SurfaceCard>
            <Text style={styles.paragraph}>
              We may share information with service providers that help us operate the app or
              with authorized users inside the PitchReady experience, such as coaches and players
              connected through app workflows. We do not sell personal information.
            </Text>
          </SurfaceCard>
        </PublicSection>

        <PublicSection title="Data retention and security">
          <SurfaceCard>
            <Text style={styles.paragraph}>
              We retain information for as long as reasonably necessary to operate PitchReady,
              comply with legal obligations, resolve disputes, and enforce our agreements. We use
              reasonable administrative, technical, and organizational measures intended to
              protect information, but no method of storage or transmission is completely secure.
            </Text>
          </SurfaceCard>
        </PublicSection>

        <PublicSection title="Your choices and requests">
          <SurfaceCard>
            <Text style={styles.paragraph}>
              You may contact us regarding account access, data correction, deletion requests, or
              other privacy questions at support@getpitchready.app.
            </Text>
          </SurfaceCard>
        </PublicSection>

        <PublicSection title="Contact">
          <SurfaceCard>
            <Text style={styles.paragraph}>
              For privacy questions or requests, contact support@getpitchready.app.
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
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  paragraph: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 24,
  },
});
