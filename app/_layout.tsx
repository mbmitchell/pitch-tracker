import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { FullScreenLoader } from '@/components/FullScreenLoader';
import { SignOutHeaderButton } from '@/features/auth/components/SignOutHeaderButton';
import { AuthProvider, useAuth } from '@/services/auth';
import { colors } from '@/utils/theme';

function RootNavigator() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const navigationState = useRootNavigationState();
  const router = useRouter();
  const segments = useSegments();

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
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerRight: isAuthenticated ? () => <SignOutHeaderButton /> : undefined,
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pitchers/new" options={{ title: 'Add Pitcher' }} />
        <Stack.Screen name="pitchers/[id]" options={{ title: 'Pitcher Profile' }} />
        <Stack.Screen name="pitchers/[id]/edit" options={{ title: 'Edit Pitcher' }} />
        <Stack.Screen name="events/new" options={{ title: 'Log Event' }} />
        <Stack.Screen
          name="recommendations/[pitcherId]"
          options={{ title: 'Recommendations' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
