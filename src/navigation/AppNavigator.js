// src/navigation/AppNavigator.js
// Root navigator — routes between Onboarding and Main app

import React, { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Colors } from '../theme';
import { useUserStore } from '../store/useUserStore';
import { navigationRef } from './navigationRef';
import { initCallReceiver, callService, processIncomingCallPayload } from '../services/callService';
import { subscribeToMyMessages } from '../services/supabase';
import IncomingCallModal from '../components/IncomingCallModal';
import * as Notifications from 'expo-notifications';
import {
  initNotifications,
  handleNotificationClick,
  checkInitialNotification,
  notifyIncomingCall,
} from '../services/notificationService';

// Onboarding
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import CreateProfileScreen from '../screens/onboarding/CreateProfileScreen';
import SetExpiryScreen from '../screens/onboarding/SetExpiryScreen';
import LoginScreen from '../screens/onboarding/LoginScreen';

// Main
import InboxScreen from '../screens/main/InboxScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import AddContactScreen from '../screens/main/AddContactScreen';
import CallScreen from '../screens/main/CallScreen';
import MediaGalleryScreen from '../screens/main/MediaGalleryScreen';
import RequestsScreen from '../screens/main/RequestsScreen';

import { MessageTabIcon, UserAvatarIcon, UserCheckIcon } from '../components/Icons';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bg.primary,
          borderTopColor: Colors.divider,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: Colors.accent.primary,
        tabBarInactiveTintColor: Colors.icon,
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
  const [incomingCallData, setIncomingCallData] = useState(null);
  const incomingCallDataRef = useRef(null);

  // Keep ref in sync with state so AppState handler can read the latest value
  const handleIncomingCall = (callPayload) => {
    incomingCallDataRef.current = callPayload;
    setIncomingCallData(callPayload);

    // Trigger high-priority heads-up notification for incoming calls
    if (callPayload) {
      notifyIncomingCall({
        callerNickname: callPayload.callerNickname,
        callerHandle: callPayload.callerHandle,
        callType: callPayload.callType,
        callId: callPayload.callId,
        callerAvatarId: callPayload.callerAvatarId,
      });
    }
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

  // Initial call receiver setup when user logs in
  useEffect(() => {
    if (isSetup && myHandle) {
      initCallReceiver(myHandle, handleIncomingCall);
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

  // Bug Fix #2: Re-subscribe to incoming call channel when app comes back to foreground.
  // When Android backgrounds the app the Supabase WebSocket may be throttled/dropped.
  // On resume we re-init the receiver and check if a call arrived while backgrounded.
  useEffect(() => {
    if (!isSetup || !myHandle) return;

    const handleAppStateChange = (nextState) => {
      if (nextState === 'active') {
        console.log('AppNavigator: App foregrounded — re-initializing call receiver');

        // Re-subscribe inbox channel (safe no-op if still healthy)
        initCallReceiver(myHandle, handleIncomingCall);

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
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isSetup, myHandle]);

  return (
    <NavigationContainer
      ref={navigationRef}
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
            <Stack.Screen name="Call" component={CallScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="AddContact" component={AddContactScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="SetExpiry" component={SetExpiryScreen} />
            <Stack.Screen name="MediaGallery" component={MediaGalleryScreen} options={{ animation: 'slide_from_right' }} />
          </>
        )}
      </Stack.Navigator>

      {/* Global Incoming Call Overlay */}
      <IncomingCallModal
        callData={incomingCallData}
        onDismiss={() => {
          incomingCallDataRef.current = null;
          setIncomingCallData(null);
        }}
      />
    </NavigationContainer>
  );
}
