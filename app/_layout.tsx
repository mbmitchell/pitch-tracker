import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppShellSyncStatus } from '@/components/AppShellSyncStatus';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { HomeHeaderButton } from '@/components/HomeHeaderButton';
import { SignOutHeaderButton } from '@/features/auth/components/SignOutHeaderButton';
import { AuthProvider, useAuth } from '@/services/auth';
import { getLinkedPitcherProfileForUser } from '@/services/pitchers';
import { OfflineSyncProvider } from '@/services/sync';
import { colors } from '@/utils/theme';

function RootNavigator() {
  const { accountType, isAuthenticated, isBootstrapping, profileAccessRefreshKey, user } =
    useAuth();
  const navigationState = useRootNavigationState();
  const router = useRouter();
  const segments = useSegments();
  const [linkedPitcherProfileId, setLinkedPitcherProfileId] = useState<string | null | undefined>(
    undefined
  );
  const isPitcherUser = accountType === 'player' || Boolean(linkedPitcherProfileId);
  const isResolvingPitcherLink = isAuthenticated && linkedPitcherProfileId === undefined;
  const shouldShowPlayerOnboarding = accountType === 'player' && !linkedPitcherProfileId;
  const homeHeaderRight =
    isAuthenticated && !isPitcherUser ? () => <HomeHeaderButton /> : undefined;

  useEffect(() => {
    let isActive = true;

    async function loadLinkedPitcherProfile() {
      if (!user?.id) {
        if (isActive) {
          setLinkedPitcherProfileId(null);
        }
        return;
      }

      setLinkedPitcherProfileId(undefined);
      const linkedPitcher = await getLinkedPitcherProfileForUser(user.id);

      if (isActive) {
        setLinkedPitcherProfileId(linkedPitcher?.id ?? null);
      }
    }

    void loadLinkedPitcherProfile();

    return () => {
      isActive = false;
    };
  }, [profileAccessRefreshKey, user?.id]);

  useEffect(() => {
    if (!navigationState?.key || isBootstrapping || isResolvingPitcherLink) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inPlayerRoute = segments[0] === 'player';
    const inPlayerOnboardingRoute = segments[0] === 'player' && segments[1] === 'onboarding';
    const inInviteRoute = segments[0] === 'invite';

    if (!isAuthenticated && !inAuthGroup && !inInviteRoute) {
      router.replace('/sign-in');
    }

    if (isAuthenticated && inAuthGroup) {
      router.replace(
        isPitcherUser ? (shouldShowPlayerOnboarding ? '/player/onboarding' : '/player') : '/'
      );
    }

    if (isAuthenticated && isPitcherUser && !inPlayerRoute && !inAuthGroup && !inInviteRoute) {
      router.replace(shouldShowPlayerOnboarding ? '/player/onboarding' : '/player');
    }

    if (isAuthenticated && isPitcherUser && inPlayerRoute && shouldShowPlayerOnboarding && !inPlayerOnboardingRoute) {
      router.replace('/player/onboarding');
    }

    if (
      isAuthenticated &&
      isPitcherUser &&
      inPlayerOnboardingRoute &&
      !shouldShowPlayerOnboarding
    ) {
      router.replace('/player');
    }

    if (isAuthenticated && !isPitcherUser && inPlayerRoute) {
      router.replace('/');
    }
  }, [
    isAuthenticated,
    isBootstrapping,
    accountType,
    isPitcherUser,
    isResolvingPitcherLink,
    shouldShowPlayerOnboarding,
    navigationState?.key,
    router,
    segments,
  ]);

  if (isBootstrapping || isResolvingPitcherLink) {
    return (
      <>
        <StatusBar style="dark" />
        <FullScreenLoader
          title="Loading session"
          subtitle="Checking your Bullpen Planner account access."
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
        <Stack.Screen name="invite/accept" options={{ title: 'Accept Invite' }} />
        <Stack.Screen
          name="player/index"
          options={{
            title: 'My View',
            headerRight: () => <SignOutHeaderButton />,
          }}
        />
        <Stack.Screen
          name="player/onboarding"
          options={{
            title: 'Player Setup',
            headerRight: () => <SignOutHeaderButton />,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="player/log-work"
          options={{
            title: 'Log Completed Work',
            headerRight: () => <SignOutHeaderButton />,
          }}
        />
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
          name="workouts/new"
          options={{ title: 'Assign Workout', headerRight: homeHeaderRight }}
        />
        <Stack.Screen
          name="recommendations/[pitcherId]"
          options={{ title: 'Recommendations', headerRight: homeHeaderRight }}
        />
        <Stack.Screen
          name="sync/index"
          options={{ title: 'Sync Details', headerRight: homeHeaderRight }}
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
