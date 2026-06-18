import { Href, Link } from 'expo-router';
import { Image } from 'expo-image';
import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors, radius, spacing } from '@/utils/theme';

type NavKey = 'home' | 'privacy' | 'terms' | 'support';

type PublicSiteLayoutProps = {
  activeNav: NavKey;
  children: ReactNode;
  introEyebrow?: string;
  introTitle?: string;
  introSubtitle?: string;
  hero?: ReactNode;
};

type NavLinkProps = {
  href: Href;
  isActive: boolean;
  label: string;
};

type LinkButtonProps = {
  href: Href;
  label: string;
  tone?: 'primary' | 'secondary';
};

type BrandIconProps = {
  size?: number;
};

const homeHref = '/' as Href;
const privacyHref = '/privacy' as Href;
const termsHref = '/terms' as Href;
const supportHref = '/support' as Href;
const supportEmailHref = 'mailto:support@getpitchready.app' as Href;
const brandIcon = require('../../../../assets/images/icon.png');

function NavLink({ href, isActive, label }: NavLinkProps) {
  return (
    <Link asChild href={href}>
      <Pressable style={({ pressed }) => [styles.navLink, pressed && styles.pressed]}>
        <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{label}</Text>
      </Pressable>
    </Link>
  );
}

export function BrandIcon({ size = 44 }: BrandIconProps) {
  return (
    <View
      style={[
        styles.brandIconFrame,
        {
          borderRadius: Math.round(size * 0.28),
          height: size,
          width: size,
        },
      ]}
    >
      <Image
        contentFit="cover"
        source={brandIcon}
        style={[
          styles.brandIconImage,
          {
            borderRadius: Math.round(size * 0.22),
          },
        ]}
      />
    </View>
  );
}

export function LinkButton({ href, label, tone = 'primary' }: LinkButtonProps) {
  return (
    <Link asChild href={href}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          tone === 'primary' ? styles.primaryButton : styles.secondaryButton,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.buttonLabel,
            tone === 'primary' ? styles.primaryButtonLabel : styles.secondaryButtonLabel,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

export function PublicSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function SurfaceCard({
  children,
  subtle = false,
}: {
  children: ReactNode;
  subtle?: boolean;
}) {
  return (
    <View style={[styles.card, subtle ? styles.cardSubtle : null]}>
      {children}
    </View>
  );
}

export function PublicSiteLayout({
  activeNav,
  children,
  introEyebrow,
  introTitle,
  introSubtitle,
  hero,
}: PublicSiteLayoutProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 920;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      style={styles.scrollView}
    >
      <View pointerEvents="none" style={styles.backgroundOrbTop} />
      <View pointerEvents="none" style={styles.backgroundOrbBottom} />

      <View style={[styles.container, isWide && styles.containerWide]}>
        <View style={[styles.topBar, !isWide && styles.topBarStacked]}>
          <Link asChild href={homeHref}>
            <Pressable style={({ pressed }) => [styles.brandLink, pressed && styles.pressed]}>
              <BrandIcon />
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>PitchReady</Text>
                <Text style={styles.brandTagline}>Workload and readiness tracking</Text>
              </View>
            </Pressable>
          </Link>

          <View style={[styles.navRow, !isWide && styles.navRowWrapped]}>
            <NavLink href={homeHref} isActive={activeNav === 'home'} label="Home" />
            <NavLink href={privacyHref} isActive={activeNav === 'privacy'} label="Privacy" />
            <NavLink href={termsHref} isActive={activeNav === 'terms'} label="Terms" />
            <NavLink href={supportHref} isActive={activeNav === 'support'} label="Support" />
          </View>
        </View>

        {hero ? <View style={styles.heroShell}>{hero}</View> : null}

        {introTitle ? (
          <View style={styles.pageIntro}>
            {introEyebrow ? <Text style={styles.eyebrow}>{introEyebrow}</Text> : null}
            <Text style={styles.pageTitle}>{introTitle}</Text>
            {introSubtitle ? <Text style={styles.pageSubtitle}>{introSubtitle}</Text> : null}
          </View>
        ) : null}

        <View style={styles.mainContent}>{children}</View>

        <View style={styles.footer}>
          <Text style={styles.footerCopy}>
            PitchReady is operated by Double M Consulting, LLC dba Aerie Solutions.
          </Text>
          <View style={styles.footerLinks}>
            <Link href={privacyHref} style={styles.footerLink}>
              Privacy Policy
            </Link>
            <Link href={termsHref} style={styles.footerLink}>
              Terms of Service
            </Link>
            <Link href={supportHref} style={styles.footerLink}>
              Support
            </Link>
          </View>
          <Text style={styles.footerCopy}>
            Support:{' '}
            <Link href={supportEmailHref} style={styles.footerEmailLink}>
              support@getpitchready.app
            </Link>
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#F4F8FC',
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 1120,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 56,
    gap: spacing.lg,
  },
  containerWide: {
    paddingTop: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  topBarStacked: {
    alignItems: 'flex-start',
  },
  brandLink: {
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandCopy: {
    gap: 2,
  },
  brandIconFrame: {
    padding: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E4F2',
    shadowColor: '#0D2740',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  brandIconImage: {
    flex: 1,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  brandTagline: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navRowWrapped: {
    flexWrap: 'wrap',
  },
  navLink: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  navLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  navLabelActive: {
    color: colors.primary,
    backgroundColor: 'transparent',
  },
  heroShell: {
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#D9E6F2',
    overflow: 'hidden',
    shadowColor: '#0D2740',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 3,
  },
  pageIntro: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  pageSubtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760,
  },
  mainContent: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionBody: {
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#D9E6F2',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardSubtle: {
    backgroundColor: '#F8FBFE',
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#C8D9E8',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButtonLabel: {
    color: colors.surface,
  },
  secondaryButtonLabel: {
    color: colors.text,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#D9E6F2',
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  footerCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  footerLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'none',
  },
  footerEmailLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'none',
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#D9EBFB',
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: 140,
    left: -110,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#EAF4FD',
  },
  pressed: {
    opacity: 0.7,
  },
});
