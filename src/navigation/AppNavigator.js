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
import { subscribeToMyMessages, fetchPendingCallInvite, fetchAndClearPendingMessages, initGlobalPresence, supabase } from '../services/supabase';
import { releaseIncoming } from '../services/incomingGuard';
import { startOutboxWorker, flushOutbox } from '../services/outbox';
import { purgeExpiredMessages } from '../db/database';
import IncomingCallModal from '../components/IncomingCallModal';
import ActiveCallBanner from '../components/ActiveCallBanner';
import BubbleAlertModal, { installBubbleAlert } from '../components/BubbleAlert';
import { processIncomingMessage, processIncomingConnectionRequest } from '../services/messageReceiver';
import * as Notifications from 'expo-notifications';
import {
  initNotifications,
  handleNotificationClick,
  checkInitialNotification,
  registerPushToken,
} from '../services/notificationService';
import { parseInviteUrl, handleIncomingInvite, checkClipboardForInvite } from '../services/inviteService';
import { TourProvider, SECUREBOX_TOUR } from '../SecureBoxTour';

// Automatically route all alerts across the app into our signature bubble style
installBubbleAlert();

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
import CalculatorScreen from '../screens/stealth/CalculatorScreen';
import BrickBreakerGameScreen from '../screens/game/BrickBreakerGameScreen';
import DecoyInboxScreen from '../screens/stealth/DecoyInboxScreen';
import ClaudeChatScreen from '../screens/main/ClaudeChatScreen';

import { MessageTabIcon, UserAvatarIcon } from '../components/Icons';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const unreadMessagesCount = useBadgeStore((s) => s.unreadMessagesCount);
  const myHandle = useUserStore((s) => s.handle);

  return (
    <TourProvider tourId="securebox-v1" userId={myHandle || 'guest'} steps={SECUREBOX_TOUR}>
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
    </TourProvider>
  );
}

export default function AppNavigator() {
  const _hasHydrated = useUserStore((s) => s._hasHydrated);
  const isSetup = useUserStore((s) => s.isSetup);
  const myHandle = useUserStore((s) => s.handle);
  const completeSetup = useUserStore((s) => s.completeSetup);
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

  // Transient timestamps for grace periods (not persisted — reset on cold start)
  const lastSignInAt = useUserStore((s) => s.lastSignInAt);
  const stealthUnlockedAt = useUserStore((s) => s.stealthUnlockedAt);

  // If local handle is stored on-device, user is permanently authenticated offline!
  const isUserAuthenticated = Boolean((isSetup || myHandle) && myHandle);

  useEffect(() => {
    if (myHandle && !isSetup) {
      completeSetup();
    }
  }, [myHandle, isSetup, completeSetup]);

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
    Linking.getInitialURL().then(async (url) => {
      if (url) {
        processUrl(url);
      } else {
        // Deferred Deep Linking: App opened directly after APK install without tapping link again!
        // Automatically check if device clipboard contains an invite copied from kanelijo.com
        const existing = useUserStore.getState().pendingInviteHandle;
        if (!existing) {
          const clipboardHandle = await checkClipboardForInvite();
          if (clipboardHandle) {
            console.log('AppNavigator: Found deferred invite in clipboard:', clipboardHandle);
            const currentSetup = useUserStore.getState().isSetup;
            const currentHandle = useUserStore.getState().handle;
            const currentNick = useUserStore.getState().nickname;
            const currentAvatar = useUserStore.getState().avatarId;

            if (!currentSetup || !currentHandle) {
              setPendingInviteHandle(clipboardHandle);
            } else {
              handleIncomingInvite(
                clipboardHandle,
                navigationRef,
                currentHandle,
                currentNick,
                currentAvatar
              );
            }
          }
        }
      }
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

      // Start global presence tracking so online indicators work across all screens
      initGlobalPresence(myHandle);

      // Check if a call invite was sent while app was launching
      fetchPendingCallInvite(myHandle).then((pending) => {
        if (pending && pending.callId) {
          console.log('AppNavigator: Processing pending call invite on setup:', pending);
          processIncomingCallPayload(pending);
        }
      }).catch(() => {});

      // Outbox: keep re-trying messages that could not be uploaded (every 15s, with back-off)
      const stopOutbox = startOutboxWorker();
      return () => stopOutbox();
    }
  }, [isSetup, myHandle]);

  // Subscribe to durable status events (including incoming calls via Postgres Changes)
  useEffect(() => {
    if (!isSetup || !myHandle) return;

    const unsub = subscribeToMyMessages(
      myHandle,
      async (incomingMsg) => {
        try {
          await processIncomingMessage(incomingMsg, myHandle);
        } catch (err) {
          console.warn('[AppNavigator] Incoming message process error:', err);
        }
      },
      async (statusEvent) => {
        if (!statusEvent) return;
        if (statusEvent.event === 'incoming_call') {
          console.log('AppNavigator: Received durable incoming_call event:', statusEvent);
          await processIncomingCallPayload(statusEvent);
        } else if (statusEvent.event === 'incoming_connection_request') {
          try {
            await processIncomingConnectionRequest(statusEvent, myHandle);
          } catch (err) {
            console.warn('[AppNavigator] Incoming connection request error:', err);
          }
        } else if (statusEvent.event === 'connection_request_accepted') {
          useBadgeStore.getState().refreshBadges(myHandle);
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

        // Keep Supabase free-tier project alive (it pauses after ~1 week of no traffic).
        // A cheap SELECT ping is enough to reset the inactivity timer.
        supabase.from('users').select('handle').limit(1).then(() => {}).catch(() => {});

        // Re-subscribe inbox channel (safe no-op if still healthy)
        initCallReceiver(myHandle, handleIncomingCall);

        // Re-init presence (WebSocket may have been dropped in background)
        initGlobalPresence(myHandle);

        // Refresh badges
        useBadgeStore.getState().refreshBadges(myHandle);

        // Messages sent while this phone was in the background / offline are NOT replayed by the
        // realtime stream. Pull them from the relay queue now (duplicate-safe), oldest first.
        fetchAndClearPendingMessages(myHandle)
          .then(async (queued) => {
            for (const m of queued || []) {
              // fetchAndClearPendingMessages claimed the id; hand it over to the receiver.
              releaseIncoming(m.id);
              try {
                await processIncomingMessage(m, myHandle);
              } catch (err) {
                console.warn('[AppNavigator] Resume message process error:', err);
              }
            }
          })
          .catch(() => {});

        // Try to upload messages that were waiting (e.g. internet came back while backgrounded)
        flushOutbox();

        // Keep the push token fresh (it can rotate, and was previously only saved at app start).
        registerPushToken(myHandle);

        // Purge expired disappearing messages & their vault media
        purgeExpiredMessages().catch(() => {});

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
        if (isStealthModeEnabled) {
          // Give a 30-second grace period before re-locking.
          // This lets the user switch apps briefly (answer a notification, check a quick thing)
          // without being forced back to the game screen every time they return.
          const unlockedAt = useUserStore.getState().stealthUnlockedAt;
          const elapsedSinceUnlock = unlockedAt ? Date.now() - unlockedAt : Infinity;
          if (elapsedSinceUnlock > 30000) {
            console.log('AppNavigator: App backgrounded >30s after last unlock — re-locking to Animal Game Decoy');
            setStealthUnlocked(false);
            setDecoyUnlocked(false);
          } else {
            console.log('AppNavigator: App backgrounded within 30s grace period — NOT re-locking');
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isSetup, myHandle]);

  // Wait until AsyncStorage finishes hydrating stored user state before mounting navigation
  if (!_hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF9F5' }} />
    );
  }

  // If Decoy Study screen was unlocked, show innocent Decoy Study Connect screen
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

  // Front-door Animal Brick Breaker Game disguise ONLY when user explicitly enables Stealth Mode
  // Grace period: if the user just signed in (< 5s ago) or just unlocked (< 5s ago),
  // skip the game gate so they land directly in the chat inbox.
  const justSignedIn = lastSignInAt && (Date.now() - lastSignInAt) < 5000;
  const justUnlocked = stealthUnlockedAt && (Date.now() - stealthUnlockedAt) < 5000;
  if (isStealthModeEnabled && !isStealthUnlocked && !justSignedIn && !justUnlocked) {
    return (
      <BrickBreakerGameScreen
        onUnlock={() => {
          setStealthUnlocked(true);
          useUserStore.getState().setStealthUnlockedAt(Date.now());
        }}
      />
    );
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
          {!isUserAuthenticated ? (
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
              <Stack.Screen name="BrickBreaker" component={BrickBreakerGameScreen} options={{ animation: 'fade', gestureEnabled: false }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {/* Global Active Call Return Banner (when call is active & user is browsing other screens) */}
      <ActiveCallBanner navigationRef={navigationRef} currentRouteName={currentRouteName} />

      {/* Global Incoming Call Overlay */}
      <IncomingCallModal
        callData={incomingCallData}
        onDismiss={() => {
          incomingCallDataRef.current = null;
          setIncomingCallData(null);
        }}
      />

      {/* Global Bubble Alert Modal */}
      <BubbleAlertModal />
    </View>
  );
}
