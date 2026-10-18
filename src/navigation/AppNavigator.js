// src/navigation/AppNavigator.js
// Root navigator — routes between Onboarding and Main app

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { Colors } from '../theme';
import { useUserStore } from '../store/useUserStore';
import { navigationRef } from './navigationRef';
import { initCallReceiver } from '../services/callService';
import IncomingCallModal from '../components/IncomingCallModal';

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

import { MessageTabIcon, UserAvatarIcon } from '../components/Icons';

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

  useEffect(() => {
    if (isSetup && myHandle) {
      initCallReceiver(myHandle, (callPayload) => {
        setIncomingCallData(callPayload);
      });
    }
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
        onDismiss={() => setIncomingCallData(null)}
      />
    </NavigationContainer>
  );
}
