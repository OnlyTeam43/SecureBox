// src/navigation/AppNavigator.js
// Root navigator — routes between Onboarding and Main app

import React, { useState, useEffect, useRef } from 'react';
import { View, AppState, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Colors } from '../theme';
import { useUserStore } from '../store/useUserStore';
import { useBadgeStore } from '../store/useBadgeStore';
import { navigationRef } from './navigationRef';
import { initCallReceiver, callService, processIncomingCallPayload } from '../services/callService';
import { subscribeToMyMessages, fetchPendingCallInvite } from '../services/supabase';
import IncomingCallModal from '../components/IncomingCallModal';
import ActiveCallBanner from '../components/ActiveCallBanner';
import InAppNotificationBanner from '../components/InAppNotificationBanner';
import * as Notifications from 'expo-notifications';
import {
  initNotifications,
  handleNotificationClick,
  checkInitialNotification,
  registerPushToken,
} from '../services/notificationService';
import { parseInviteUrl, handleIncomingInvite } from '../services/inviteService';

// Onboarding
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import CreateProfileScreen from '../screens/onboarding/CreateProfileScreen';
import SetExpiryScreen from '../screens/onboarding/SetExpiryScreen';
import LoginScreen from '../screens/onboarding/LoginScreen';

// Main
import InboxScreen from '../screens/main/InboxScreen';
import CallsScreen from '../screens/main/CallsScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import AddContactScreen from '../screens/main/AddContactScreen';
import CallScreen from '../screens/main/CallScreen';
import MediaGalleryScreen from '../screens/main/MediaGalleryScreen';
import RequestsScreen from '../screens/main/RequestsScreen';
import CalculatorScreen from '../screens/stealth/CalculatorScreen';
import BrickBreakerGameScreen from '../screens/game/BrickBreakerGameScreen';
import DecoyInboxScreen from '../screens/stealth/DecoyInboxScreen';
import ClaudeChatScreen from '../screens/main/ClaudeChatScreen';

import { MessageTabIcon, PhoneIcon, UserAvatarIcon, UserCheckIcon } from '../components/Icons';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const unreadMessagesCount = useBadgeStore((s) => s.unreadMessagesCount);
  const missedCallsCount = useBadgeStore((s) => s.missedCallsCount);
  const pendingRequestsCount = useBadgeStore((s) => s.pendingRequestsCount);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FAF9F5',
          borderTopColor: 'rgba(20,20,19,0.08)',
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#D97757',
        tabBarInactiveTintColor: '#87867F',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color }) => (
            <MessageTabIcon size={22} color={color} />
          ),
          tabBarBadge: unreadMessagesCount > 0 ? (unreadMessagesCount > 99 ? '99+' : unreadMessagesCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.accent.primary, color: '#fff', fontSize: 10, fontWeight: '700' },
        }}
      />
      <Tab.Screen
        name="Calls"
        component={CallsScreen}
        options={{
          tabBarLabel: 'Calls',
          tabBarIcon: ({ color }) => (
            <PhoneIcon size={22} color={color} />
          ),
          tabBarBadge: missedCallsCount > 0 ? (missedCallsCount > 99 ? '99+' : missedCallsCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.accent.primary, color: '#fff', fontSize: 10, fontWeight: '700' },
        }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{
          tabBarLabel: 'Requests',
          tabBarIcon: ({ color }) => (
            <UserCheckIcon size={22} color={color} />
          ),
          tabBarBadge: pendingRequestsCount > 0 ? (pendingRequestsCount > 99 ? '99+' : pendingRequestsCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.accent.primary, color: '#fff', fontSize: 10, fontWeight: '700' },
        }}
      />
      <Tab.Screen
        name="Me"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <UserAvatarIcon size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const isSetup = useUserStore((s) => s.isSetup);
  const myHandle = useUserStore((s) => s.handle);
  const myNickname = useUserStore((s) => s.nickname);
  const myAvatarId = useUserStore((s) => s.avatarId);
  const pendingInviteHandle = useUserStore((s) => s.pendingInviteHandle);
  const setPendingInviteHandle = useUserStore((s) => s.setPendingInviteHandle);
  const clearPendingInviteHandle = useUserStore((s) => s.clearPendingInviteHandle);

  const isStealthModeEnabled = useUserStore((s) => s.isStealthModeEnabled);
  const isStealthUnlocked = useUserStore((s) => s.isStealthUnlocked);
  const setStealthUnlocked = useUserStore((s) => s.setStealthUnlocked);
  const isDecoyUnlocked = useUserStore((s) => s.isDecoyUnlocked);
  const setDecoyUnlocked = useUserStore((s) => s.setDecoyUnlocked);

  const [incomingCallData, setIncomingCallData] = useState(null);
  const [currentRouteName, setCurrentRouteName] = useState(null);
  const incomingCallDataRef = useRef(null);

  // Deep linking: Handle profile/handle invite URLs (e.g. securebox://invite/alex)
  useEffect(() => {
    const processUrl = (url) => {
      if (!url) return;
      console.log('AppNavigator: Processing deep link URL:', url);
      const targetHandle = parseInviteUrl(url);
      if (!targetHandle) return;

      const currentSetup = useUserStore.getState().isSetup;
      const currentHandle = useUserStore.getState().handle;
      const currentNick = useUserStore.getState().nickname;
      const currentAvatar = useUserStore.getState().avatarId;

      if (!currentSetup || !currentHandle) {
        // Save pending handle in store; once setup is finished, prompt the user
        console.log('AppNavigator: User not yet logged in, saving pending invite:', targetHandle);
        setPendingInviteHandle(targetHandle);
      } else {
        handleIncomingInvite(
          targetHandle,
          navigationRef,
          currentHandle,
          currentNick,
          currentAvatar
        );
      }
    };

    // 1. App opened from cold start via deep link
    Linking.getInitialURL().then((url) => {
      if (url) processUrl(url);
    });

    // 2. App already running in foreground/background and deep link clicked
    const sub = Linking.addEventListener('url', ({ url }) => {
      processUrl(url);
    });

    return () => sub.remove();
  }, []);

  // When setup completes or user is logged in, check if there was a saved pending invite
  useEffect(() => {
    if (isSetup && myHandle && pendingInviteHandle) {
      const target = pendingInviteHandle;
      clearPendingInviteHandle();
      setTimeout(() => {
        handleIncomingInvite(
          target,
          navigationRef,
          myHandle,
          myNickname,
          myAvatarId
        );
      }, 800);
    }
  }, [isSetup, myHandle, pendingInviteHandle]);

  // Keep ref in sync with state so AppState handler can read the latest value
  const handleIncomingCall = (callPayload) => {
    incomingCallDataRef.current = callPayload;
    setIncomingCallData(callPayload);
  };

  // Initialize notifications & setup click listeners
  useEffect(() => {
    initNotifications();

    const responseSub = Notifications.addNotificationResponseReceivedListener(handleNotificationClick);
    checkInitialNotification();

    return () => {
      responseSub.remove();
    };
  }, []);

  // Initial call receiver setup, badge check & remote push token registration when user logs in
  useEffect(() => {
    if (isSetup && myHandle) {
      initCallReceiver(myHandle, handleIncomingCall);
      useBadgeStore.getState().refreshBadges(myHandle);
      registerPushToken(myHandle);

      // Check if a call invite was sent while app was launching
      fetchPendingCallInvite(myHandle).then((pending) => {
        if (pending && pending.callId) {
          console.log('AppNavigator: Processing pending call invite on setup:', pending);
          processIncomingCallPayload(pending);
        }
      }).catch(() => {});
    }
  }, [isSetup, myHandle]);

  // Subscribe to durable status events (including incoming calls via Postgres Changes)
  useEffect(() => {
    if (!isSetup || !myHandle) return;

    const unsub = subscribeToMyMessages(
      myHandle,
      null,
      async (statusEvent) => {
        if (!statusEvent) return;
        if (statusEvent.event === 'incoming_call') {
          console.log('AppNavigator: Received durable incoming_call event:', statusEvent);
          await processIncomingCallPayload(statusEvent);
        }
      }
    );

    return () => unsub();
  }, [isSetup, myHandle]);

  // Re-subscribe to incoming call channel & poll pending invite when app comes to foreground.
  // When Android backgrounds the app the Supabase WebSocket may be throttled/dropped.
  // On resume we re-init the receiver and check if a call arrived while backgrounded.
  useEffect(() => {
    if (!isSetup || !myHandle) return;

    const handleAppStateChange = (nextState) => {
      if (nextState === 'active') {
        console.log('AppNavigator: App foregrounded — re-initializing call receiver & refreshing badges');

        // Re-subscribe inbox channel (safe no-op if still healthy)
        initCallReceiver(myHandle, handleIncomingCall);

        // Refresh badges
        useBadgeStore.getState().refreshBadges(myHandle);

        // Check if an incoming call invite arrived while backgrounded or closed (<35s)
        fetchPendingCallInvite(myHandle).then((pending) => {
          if (pending && pending.callId) {
            console.log('AppNavigator: Found pending call invite on resume:', pending);
            processIncomingCallPayload(pending);
          }
        }).catch(() => {});

        // If there's a pending incoming call that we may have missed while backgrounded,
        // reconstruct the modal payload from module-level state
        const active = callService.getActiveCall();
        if (
          active &&
          active.status === 'incoming' &&
          !incomingCallDataRef.current
        ) {
          const reconstructed = {
            callId: active.callId,
            callerHandle: active.partnerHandle,
            callerNickname: active.partnerNickname,
            callerAvatarId: active.partnerAvatarId,
            callType: active.callType,
          };
          console.log('AppNavigator: Reconstructing missed incoming call modal', reconstructed);
          handleIncomingCall(reconstructed);
        }
      } else if (nextState === 'background') {
        // Automatically re-lock to decoy Animal Smash game when app is minimized or phone locked
        console.log('AppNavigator: App backgrounded — re-locking to Animal Game Decoy');
        setStealthUnlocked(false);
        setDecoyUnlocked(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isSetup, myHandle]);

  // If Decoy PIN was entered (e.g. 0000), show innocent Decoy Study Connect screen
  if (isDecoyUnlocked) {
    return (
      <DecoyInboxScreen
        onLock={() => {
          setDecoyUnlocked(false);
          setStealthUnlocked(false);
        }}
      />
    );
  }

  // Front-door Animal Brick Breaker Game until unlocked with PIN (or via Google Sign-In for new users)
  if (!isStealthUnlocked) {
    return <BrickBreakerGameScreen onUnlock={() => setStealthUnlocked(true)} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg.primary }}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          setCurrentRouteName(navigationRef.getCurrentRoute()?.name);
        }}
        onStateChange={() => {
          const currentRoute = navigationRef.getCurrentRoute();
          setCurrentRouteName(currentRoute?.name);
        }}
        theme={{
          dark: false,
          colors: {
            primary: Colors.accent.primary,
            background: Colors.bg.primary,
            card: Colors.bg.primary,
            text: Colors.text.primary,
            border: Colors.divider,
            notification: Colors.accent.primary,
          },
        }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          {!isSetup ? (
            // Onboarding flow
            <>
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="CreateProfile" component={CreateProfileScreen} />
              <Stack.Screen name="SetExpiry" component={SetExpiryScreen} />
            </>
          ) : (
            // Main app
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="ClaudeChat" component={ClaudeChatScreen} options={{ animation: 'fade' }} />
              <Stack.Screen name="Call" component={CallScreen} options={{ animation: 'fade' }} />
              <Stack.Screen name="AddContact" component={AddContactScreen} options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="SetExpiry" component={SetExpiryScreen} />
              <Stack.Screen name="MediaGallery" component={MediaGalleryScreen} options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="BrickBreaker" component={BrickBreakerGameScreen} options={{ animation: 'fade' }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {/* Global Active Call Return Banner (when call is active & user is browsing other screens) */}
      <ActiveCallBanner navigationRef={navigationRef} currentRouteName={currentRouteName} />

      {/* Global In-App Notification Toast */}
      <InAppNotificationBanner navigationRef={navigationRef} />

      {/* Global Incoming Call Overlay */}
      <IncomingCallModal
        callData={incomingCallData}
        onDismiss={() => {
          incomingCallDataRef.current = null;
          setIncomingCallData(null);
        }}
      />
    </View>
  );
}
