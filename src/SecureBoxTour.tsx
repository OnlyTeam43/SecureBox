import React from 'react';
import { ScrollView } from 'react-native';
import { navigationRef } from './navigation/navigationRef';
import { TourProvider, TourStep, TourTarget, useTour } from './SpotlightTour';

// Give your Profile ScrollView this ref so the tour can scroll to a target.
export const profileScroll = React.createRef<ScrollView>();

const goMessages = () => {
  if (navigationRef.isReady()) {
    try {
      (navigationRef as any).navigate('MainTabs', { screen: 'Inbox' });
    } catch {
      (navigationRef as any).navigate('Inbox');
    }
  }
};
const goProfile = () => {
  if (navigationRef.isReady()) {
    try {
      (navigationRef as any).navigate('MainTabs', { screen: 'Me' });
    } catch {
      (navigationRef as any).navigate('Me');
    }
  }
};
const scrollTop = () => profileScroll.current?.scrollTo({ y: 0, animated: false });
const scrollDown = () => profileScroll.current?.scrollToEnd({ animated: false });

// Seven steps: three on Messages, four on Profile.
export const SECUREBOX_TOUR: TourStep[] = [
  {
    key: 'search',
    onEnter: goMessages,
    title: 'Find someone by handle',
    body: 'Type a friend’s unique @handle here to send a connection request. Chats open once they accept.',
  },
  {
    key: 'game',
    title: 'Switch to the game instantly',
    body: 'If someone walks up, tap Game to jump straight back to the brick game and hide your chats.',
  },
  {
    key: 'invite',
    title: 'Invite a friend',
    body: 'Tap Invite to share your link with the app download, so your friend can join and connect with you.',
    hint: 'Next takes you to Profile.',
  },
  {
    key: 'disappearing',
    onEnter: async () => {
      goProfile();
      await new Promise<void>((r) => setTimeout(r, 300));
      scrollTop();
    },
    title: 'Disappearing messages',
    body: 'Choose how long chats stay before they erase themselves. The default is Never.',
  },
  {
    key: 'gallery',
    title: 'Private media vault',
    body: 'Store hidden personal photos from your phone and view private photos exchanged in chats. They stay safely in your sandbox.',
    hint: 'Next scrolls down.',
  },
  {
    key: 'decoy',
    onEnter: scrollDown,
    title: 'Animal game decoy mode',
    body: 'Turn this on and the app disguises itself as the brick game when your phone locks. Hold the center animal for 3 seconds to unlock.',
  },
  {
    key: 'erase',
    title: 'Instant erase',
    body: 'One tap wipes all messages, media, call logs and keys from this phone. Use it only in an emergency. It can’t be undone.',
  },
];

export function AppWithTour({ userId, children }: { userId: string; children: React.ReactNode }) {
  return (
    <TourProvider tourId="securebox-v1" userId={userId} steps={SECUREBOX_TOUR}>
      {children}
    </TourProvider>
  );
}

export { TourProvider, TourTarget, useTour };
