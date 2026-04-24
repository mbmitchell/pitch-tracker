import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppShellSyncStatus } from '@/components/AppShellSyncStatus';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { HomeHeaderButton } from '@/components/HomeHeaderButton';
import { AuthProvider, useAuth } from '@/services/auth';
import { OfflineSyncProvider } from '@/services/sync';
import { colors } from '@/utils/theme';

function RootNavigator() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const navigationState = useRootNavigationState();
  const router = useRouter();
  const segments = useSegments();
  const homeHeaderRight = isAuthenticated ? () => <HomeHeaderButton /> : undefined;

  useEffect(() => {
    if (!navigationState?.key || isBootstrapping) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/sign-in');
    }

    if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, isBootstrapping, navigationState?.key, router, segments]);

  if (isBootstrapping) {
    return (
      <>
        <StatusBar style="dark" />
        <FullScreenLoader
          title="Loading session"
          subtitle="Checking your Bullpen Planner coach session."
        />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
        <Stack.Screen
          name="pitchers/new"
          options={{ title: 'Add Pitcher', headerRight: homeHeaderRight }}
        />
        <Stack.Screen
          name="pitchers/[id]"
          options={{ title: 'Pitcher Profile', headerRight: homeHeaderRight }}
        />
        <Stack.Screen
          name="pitchers/status"
          options={{ title: 'Pitchers', headerRight: homeHeaderRight }}
        />
        <Stack.Screen
          name="pitchers/[id]/edit"
          options={{ title: 'Edit Pitcher', headerRight: homeHeaderRight }}
        />
        <Stack.Screen
          name="events/new"
          options={{ title: 'Log Event', headerRight: homeHeaderRight }}
        />
        <Stack.Screen
          name="recommendations/[pitcherId]"
          options={{ title: 'Recommendations', headerRight: homeHeaderRight }}
        />
      </Stack>
      <AppShellSyncStatus />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <OfflineSyncProvider>
        <RootNavigator />
      </OfflineSyncProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
