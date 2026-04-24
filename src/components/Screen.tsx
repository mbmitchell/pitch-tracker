import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/utils/theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  keyboardAware?: boolean;
  keyboardVerticalOffset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  title,
  subtitle,
  children,
  keyboardAware = false,
  keyboardVerticalOffset = 0,
  contentContainerStyle,
}: ScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={keyboardAware}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            keyboardAware ? styles.keyboardAwareContent : null,
            contentContainerStyle,
          ]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  keyboardAwareContent: {
    paddingBottom: 48,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
});
