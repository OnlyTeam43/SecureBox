// client/src/App.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Colors } from './theme/tokens';
import { RoomMetadata, ChatMessage, ScreenMode } from './types';
import {
  generateRoomId,
  importSecretKey,
  encryptData,
  decryptData,
  hashPin,
  deriveKeyFromPin,
  exportKeyToString,
} from './services/crypto';
import {
  getOrCreateRoomState,
  sendEncryptedMessage,
  fetchAndClearOfflineMessages,
  subscribeToRoom,
  sendTypingStatus,
  sendWipeSignal,
  extendRoomLifespan,
} from './services/supabase';

import { BrickSmashGame } from './components/BrickSmashGame';
import { PinModal } from './components/PinModal';
import { RoomHub } from './components/RoomHub';
import { JoinModal } from './components/JoinModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ShareModal } from './components/ShareModal';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessages } from './components/ChatMessages';
import { Composer } from './components/Composer';
import { SecureboxPage } from './components/SecureboxPage';
import { QuickDropModal } from './components/QuickDropModal';

// ─── Storage Key Constants ──────────────────────────────────────────────────
const HUB_KEY = 'securebox_hub_hash';
const ROOMS_KEY = 'securebox_rooms';
const ACTIVE_ROOM_KEY = 'securebox_active_room_id';

const isDropRoute = (path: string, hash: string = ''): boolean => {
  const clean = path.toLowerCase().replace(/\/+$/, '');
  const cleanHash = hash.toLowerCase();
  return (
    clean === '/drop' ||
    clean.endsWith('/drop') ||
    clean === '/quickdrop' ||
    clean.endsWith('/quickdrop') ||
    cleanHash.startsWith('#drop') ||
    cleanHash.includes('code=')
  );
};

const isSecureboxRoute = (path: string): boolean => {
  const clean = path.toLowerCase().replace(/\/+$/, '');
  return clean === '/securebox' || clean.endsWith('/securebox');
};

// Helper to sum unread messages across all saved rooms
const getTotalUnreadCount = (): number => {
  const raw = localStorage.getItem(ROOMS_KEY);
  if (!raw) return 0;
  try {
    const map = JSON.parse(raw);
    let total = 0;
    for (const rId of Object.keys(map)) {
      const c = parseInt(localStorage.getItem(`securebox_unread_count_${rId}`) || '0', 10);
      if (c > 0) total += c;
    }
    return total;
  } catch (_) {
    return 0;
  }
};

export const App: React.FC = () => {
  const [isQuickDropOpen, setIsQuickDropOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isDropRoute(window.location.pathname, window.location.hash) : false
  );
  const [quickDropCode, setQuickDropCode] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const hash = window.location.hash.slice(1);
    const p = new URLSearchParams(hash.includes('=') ? hash : '');
    return p.get('code') || '';
  });
  const [quickDropTab, setQuickDropTab] = useState<'upload' | 'retrieve'>(() => {
    if (typeof window === 'undefined') return 'upload';
    const hash = window.location.hash.slice(1);
    const p = new URLSearchParams(hash.includes('=') ? hash : '');
    return p.get('code') ? 'retrieve' : 'upload';
  });

  const [isDedicatedPage, setIsDedicatedPage] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isSecureboxRoute(window.location.pathname) : false
  );

  useEffect(() => {
    const handlePop = () => {
      setIsDedicatedPage(isSecureboxRoute(window.location.pathname));
      if (isDropRoute(window.location.pathname, window.location.hash)) {
        const hash = window.location.hash.slice(1);
        const p = new URLSearchParams(hash.includes('=') ? hash : '');
        const c = p.get('code');
        if (c) {
          setQuickDropCode(c);
          setQuickDropTab('retrieve');
        }
        setIsQuickDropOpen(true);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hasHandle = !!localStorage.getItem('securebox_user_handle');
    const hasHubPin = !!localStorage.getItem(HUB_KEY);
    return !hasHandle || !hasHubPin;
  });
  const [screenMode, setScreenMode] = useState<ScreenMode>('hub');
  const screenModeRef = useRef<ScreenMode>(screenMode);
  screenModeRef.current = screenMode;

  const [activeRoom, setActiveRoom] = useState<RoomMetadata | null>(null);
  const activeRoomRef = useRef<RoomMetadata | null>(activeRoom);
  activeRoomRef.current = activeRoom;

  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const cryptoKeyRef = useRef<CryptoKey | null>(cryptoKey);
  cryptoKeyRef.current = cryptoKey;

  const [savedRooms, setSavedRooms] = useState<RoomMetadata[]>(() => {
    const raw = localStorage.getItem(ROOMS_KEY);
    return raw ? Object.values(JSON.parse(raw)) : [];
  });

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [pendingJoin, setPendingJoin] = useState<{ roomId: string; secretKey: string } | null>(null);

  // Unread badge count connected directly across all rooms
  const [unreadCount, setUnreadCount] = useState<number>(() => getTotalUnreadCount());

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUnlockAction = useRef<(() => void) | null>(null);

  // Reset unread count for current room when entering chat
  useEffect(() => {
    if (screenMode === 'chat' && activeRoom) {
      localStorage.setItem(`securebox_unread_count_${activeRoom.roomId}`, '0');
      setUnreadCount(getTotalUnreadCount());
    }
  }, [screenMode, activeRoom?.roomId]);

  // Restore active room & cryptoKey silently on load
  useEffect(() => {
    const activeId = localStorage.getItem(ACTIVE_ROOM_KEY);
    const stored = localStorage.getItem(ROOMS_KEY);
    const map = stored ? JSON.parse(stored) : {};

    let targetRoom: RoomMetadata | null = null;
    if (activeId && map[activeId]) {
      targetRoom = map[activeId] as RoomMetadata;
    }

    if (targetRoom) {
      const isStillValid =
        (targetRoom.expiresAt && Date.now() < targetRoom.expiresAt) ||
        (!targetRoom.expiresAt && Date.now() - (targetRoom.createdAt || 0) < 24 * 60 * 60 * 1000);
      if (isStillValid) {
        setActiveRoom(targetRoom);
        importSecretKey(targetRoom.secretKey)
          .then((key) => setCryptoKey(key))
          .catch(() => {});
      } else {
        deleteRoom(targetRoom.roomId);
        setActiveRoom(null);
        setCryptoKey(null);
      }
    }
    // Update badge count on initial load
    setUnreadCount(getTotalUnreadCount());
  }, []);

  // Parse URL on load — handle invite link (#roomId) or plain game view
  useEffect(() => {
    const parseUrl = async () => {
      const rawHash = window.location.hash.slice(1).trim();

      // QuickDrop direct link (#code=... or #drop)
      if (rawHash.includes('code=') || rawHash === 'drop') {
        const p = new URLSearchParams(rawHash.includes('=') ? rawHash : '');
        const c = p.get('code');
        if (c) {
          setQuickDropCode(c);
          setQuickDropTab('retrieve');
        } else {
          setQuickDropTab('upload');
        }
        setIsQuickDropOpen(true);
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      // Clear the URL hash immediately so refresh never re-triggers join
      if (rawHash) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      const params = new URLSearchParams(rawHash.includes('=') ? rawHash : '');
      let roomId = params.get('id') || params.get('room');
      let secretKey = params.get('key') || params.get('k') || '';

      // Short link: #k9x2m4
      if (!roomId && rawHash && !rawHash.includes('&') && !rawHash.includes('=')) {
        roomId = rawHash.toLowerCase();
      }

      if (!roomId) {
        return;
      }

      const stored = localStorage.getItem(ROOMS_KEY);
      const map = stored ? JSON.parse(stored) : {};

      if (map[roomId]) {
        // Returning member — validate expiry then ask for hub password to unlock
        const room = map[roomId] as RoomMetadata;
        const isStillValid =
          (room.expiresAt && Date.now() < room.expiresAt) ||
          (!room.expiresAt && Date.now() - (room.createdAt || 0) < 24 * 60 * 60 * 1000);

        if (isStillValid) {
          pendingUnlockAction.current = () => enterRoom(room);
          setIsPinModalOpen(true);
        } else {
          alert('This room has expired (24 hours have passed).');
          deleteRoom(roomId);
          setScreenMode('hub');
        }
      } else {
        // Brand new guest — go to join screen to enter room PIN
        setPendingJoin({ roomId, secretKey });
        setScreenMode('join');
      }
    };

    parseUrl();
  }, []);

  // Per requirements: Never fall into game mode automatically unless user clicks Play Game

  // Strict Chat Isolation: flush on room change
  useEffect(() => {
    setMessages([]);
    if (!activeRoom) return;

    const key = `room_chat_${activeRoom.roomId}`;
    const local = localStorage.getItem(key);
    if (local) {
      try {
        setMessages(JSON.parse(local));
      } catch (_) {
        setMessages([]);
      }
    }
  }, [activeRoom?.roomId]);

  // ─── Incoming packet handler with live screenModeRef ───────────────────────
  const handleIncomingPacket = useCallback(
    async (packet: { id: string; sender: string; iv: string; data: string; timestamp?: number }) => {
      const room = activeRoomRef.current;
      const key = cryptoKeyRef.current;
      if (!key || !room) return;
      if (packet.sender.toLowerCase() === room.myHandle.toLowerCase()) return;

      // Register partner handle from first message if not saved yet
      if (!room.partnerHandle && packet.sender) {
        const updated = { ...room, partnerHandle: packet.sender };
        saveRoom(updated);
        setActiveRoom(updated);
      }

      try {
        const decrypted = await decryptData(key, { iv: packet.iv, data: packet.data });
        const parsed = JSON.parse(decrypted);

        const newMsg: ChatMessage = {
          id: packet.id || `msg_${Date.now()}`,
          sender: packet.sender,
          text: parsed.text || '',
          media: parsed.media || null,
          timestamp: packet.timestamp || Date.now(),
          isOutgoing: false,
        };

        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          const next = [...prev, newMsg];
          try {
            localStorage.setItem(`room_chat_${room.roomId}`, JSON.stringify(next));
          } catch (storageErr) {
            console.warn('LocalStorage save warning:', storageErr);
            try {
              localStorage.setItem(`room_chat_${room.roomId}`, JSON.stringify(next.slice(-25)));
            } catch (_) {}
          }
          return next;
        });

        // If not actively looking at this chat, increment unread badge count!
        if (screenModeRef.current !== 'chat') {
          const currentCount = parseInt(localStorage.getItem(`securebox_unread_count_${room.roomId}`) || '0', 10);
          const nextCount = currentCount + 1;
          localStorage.setItem(`securebox_unread_count_${room.roomId}`, String(nextCount));
          setUnreadCount(getTotalUnreadCount());
        }
      } catch (err) {
        console.warn('Failed to decrypt packet:', err);
      }
    },
    []
  );

  // ─── Persistence helpers ─────────────────────────────────────────────────
  const saveRoom = (room: RoomMetadata) => {
    const raw = localStorage.getItem(ROOMS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[room.roomId] = room;
    localStorage.setItem(ROOMS_KEY, JSON.stringify(map));
    setSavedRooms(Object.values(map));
  };

  const deleteRoom = (roomId: string) => {
    const raw = localStorage.getItem(ROOMS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    delete map[roomId];
    localStorage.setItem(ROOMS_KEY, JSON.stringify(map));
    localStorage.removeItem(`room_chat_${roomId}`);
    localStorage.removeItem(`securebox_unread_count_${roomId}`);
    if (localStorage.getItem(ACTIVE_ROOM_KEY) === roomId) {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
    }
    if (activeRoom?.roomId === roomId) {
      setActiveRoom(null);
      setCryptoKey(null);
      setMessages([]);
    }
    setSavedRooms(Object.values(map));
    setUnreadCount(getTotalUnreadCount());
  };

  // ─── Real-time subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoom || !cryptoKey) return;

    const channel = subscribeToRoom(activeRoom.roomId, activeRoom.myHandle, {
      onMessage: (payload) => handleIncomingPacket(payload),
      onTyping: ({ sender, isTyping }) => {
        setTypingUser(isTyping ? sender : null);
      },
      onPresenceChange: (activeUsers) => {
        const myName = activeRoom.myHandle.toLowerCase();
        const otherUser = activeUsers.find((u) => u.toLowerCase() !== myName);
        if (otherUser && !activeRoom.partnerHandle) {
          const updated = { ...activeRoom, partnerHandle: otherUser };
          saveRoom(updated);
          setActiveRoom(updated);
        }
        const cleanPartner = (activeRoom.partnerHandle || otherUser || '').toLowerCase();
        const isOnline = cleanPartner
          ? activeUsers.some((u) => u.toLowerCase() === cleanPartner)
          : false;
        setIsPartnerOnline(isOnline);
      },
      onRoomExtended: (newExpiresAt) => {
        setActiveRoom((prev) => {
          if (!prev) return null;
          const updated = { ...prev, expiresAt: newExpiresAt };
          saveRoom(updated);
          return updated;
        });
      },
      onWipe: () => {
        if (activeRoom) deleteRoom(activeRoom.roomId);
        localStorage.removeItem(ACTIVE_ROOM_KEY);
        setMessages([]);
        setActiveRoom(null);
        setCryptoKey(null);
        alert('This room was self-destructed and completely wiped.');
        setScreenMode('hub');
      },
    });

    return () => {
      try { channel.unsubscribe(); } catch (_) {}
    };
  }, [activeRoom?.roomId, cryptoKey]);

  // ─── Offline relay poll ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoom || !cryptoKey) return;

    const pullOffline = () => {
      fetchAndClearOfflineMessages(activeRoom.roomId, activeRoom.myHandle).then((packets) => {
        packets.forEach((p) => handleIncomingPacket(p));
      });
    };

    pullOffline();

    const ms = screenMode === 'chat' ? 3000 : 7000;
    const interval = setInterval(pullOffline, ms);

    const onVisible = () => {
      if (document.visibilityState === 'visible') pullOffline();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeRoom?.roomId, cryptoKey, screenMode, handleIncomingPacket]);

  // ─── Enter a room (flush state first, then load) ──────────────────────────
  const enterRoom = async (room: RoomMetadata) => {
    try {
      setMessages([]);
      setIsPartnerOnline(false);
      setTypingUser(null);

      const key = await importSecretKey(room.secretKey);
      setCryptoKey(key);
      setActiveRoom(room);
      localStorage.setItem(ACTIVE_ROOM_KEY, room.roomId);

      // Clear unread for this entered room
      localStorage.setItem(`securebox_unread_count_${room.roomId}`, '0');
      setUnreadCount(getTotalUnreadCount());

      setScreenMode('chat');
      document.title = `Chat - ${room.partnerHandle || 'Private'}`;
    } catch (err) {
      alert('Failed to enter room. Cryptographic key invalid.');
    }
  };

  // ─── Create Room ─────────────────────────────────────────────────────────
  const handleCreateRoom = async (handle: string, roomPin: string) => {
    const pHash = await hashPin(roomPin);
    const roomId = generateRoomId();
    const derivedKey = await deriveKeyFromPin(roomPin, roomId);
    const secretKey = await exportKeyToString(derivedKey);

    const state = await getOrCreateRoomState(roomId, handle, true, pHash);
    if (!state.success) {
      alert(state.error || 'Failed to create room.');
      return;
    }

    const room: RoomMetadata = {
      roomId,
      secretKey,
      myHandle: handle,
      partnerHandle: null,
      isCreator: true,
      createdAt: Date.now(),
      pinHash: pHash,
    };

    setMessages([]);
    saveRoom(room);
    setActiveRoom(room);
    setCryptoKey(derivedKey);
    localStorage.setItem(ACTIVE_ROOM_KEY, roomId);

    const base = window.location.origin + window.location.pathname;
    setShareLink(`${base}#${roomId}`);
    setIsShareModalOpen(true);
  };

  // ─── Join Room (guest via link) ──────────────────────────────────────────
  const handleJoinRoom = async (handle: string, roomPin: string) => {
    if (!pendingJoin) return;
    const pHash = await hashPin(roomPin);

    const state = await getOrCreateRoomState(pendingJoin.roomId, handle, false, pHash);
    if (!state.success) {
      alert(state.error || 'Failed to join room. Check your 4-digit Room PIN.');
      return;
    }

    let derivedKey: CryptoKey;
    let secretKey: string;
    if (pendingJoin.secretKey) {
      derivedKey = await importSecretKey(pendingJoin.secretKey);
      secretKey = pendingJoin.secretKey;
    } else {
      derivedKey = await deriveKeyFromPin(roomPin, pendingJoin.roomId);
      secretKey = await exportKeyToString(derivedKey);
    }

    const room: RoomMetadata = {
      roomId: pendingJoin.roomId,
      secretKey,
      myHandle: handle,
      partnerHandle: state.partner || null,
      isCreator: false,
      createdAt: Date.now(),
      pinHash: pHash,
    };

    setMessages([]);
    saveRoom(room);
    setCryptoKey(derivedKey);
    localStorage.setItem(ACTIVE_ROOM_KEY, room.roomId);
    setPendingJoin(null);

    setActiveRoom(room);
    setScreenMode('chat');
    document.title = `Chat - ${room.partnerHandle || 'Private'}`;

    if (!localStorage.getItem(HUB_KEY)) {
      setTimeout(() => {
        pendingUnlockAction.current = null;
        setIsPinModalOpen(true);
      }, 1500);
    }
  };

  // ─── Send Message ────────────────────────────────────────────────────────
  const handleSendMessage = async (text: string) => {
    if (!activeRoom || !cryptoKey) return;
    const isOnline = isPartnerOnline;
    const payload = JSON.stringify({ text });

    try {
      const encrypted = await encryptData(cryptoKey, payload);
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const newMsg: ChatMessage = {
        id: msgId,
        sender: activeRoom.myHandle,
        text,
        media: null,
        timestamp: Date.now(),
        isOutgoing: true,
      };

      setMessages((prev) => {
        const next = [...prev, newMsg];
        try {
          localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next));
        } catch (_) {}
        return next;
      });

      await sendEncryptedMessage({
        roomId: activeRoom.roomId,
        sender: activeRoom.myHandle,
        recipient: activeRoom.partnerHandle,
        encryptedPayload: encrypted,
      });
    } catch (err) {
      alert('Failed to encrypt or deliver message.');
    }
  };

  // ─── Send Media ──────────────────────────────────────────────────────────
  const handleSendMedia = async (mediaDataUrl: string) => {
    if (!activeRoom || !cryptoKey) return;
    const isOnline = isPartnerOnline;
    const payload = JSON.stringify({ media: mediaDataUrl });

    try {
      const encrypted = await encryptData(cryptoKey, payload);
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const newMsg: ChatMessage = {
        id: msgId,
        sender: activeRoom.myHandle,
        text: '',
        media: mediaDataUrl,
        timestamp: Date.now(),
        isOutgoing: true,
      };

      setMessages((prev) => {
        const next = [...prev, newMsg];
        try {
          localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next));
        } catch (_) {}
        return next;
      });

      await sendEncryptedMessage({
        roomId: activeRoom.roomId,
        sender: activeRoom.myHandle,
        recipient: activeRoom.partnerHandle,
        encryptedPayload: encrypted,
      });
    } catch (err) {
      alert('Failed to encrypt or deliver photo.');
    }
  };

  // ─── Typing indicator ────────────────────────────────────────────────────
  const handleTyping = () => {
    if (!activeRoom) return;
    sendTypingStatus(activeRoom.roomId, activeRoom.myHandle, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (activeRoom) {
        sendTypingStatus(activeRoom.roomId, activeRoom.myHandle, false);
      }
    }, 2000);
  };

  // ─── Room Options (Extend Lifespan / Wipe Room) ───────────────────────────
  const handleExtendRoom = async () => {
    if (!activeRoom) return;
    const success = await extendRoomLifespan(activeRoom.roomId);
    if (success) {
      const newExpiry = (activeRoom.expiresAt || Date.now()) + 24 * 60 * 60 * 1000;
      const updated = { ...activeRoom, expiresAt: newExpiry };
      saveRoom(updated);
      setActiveRoom(updated);
      alert('Room lifespan extended by +24 hours.');
    } else {
      alert('Failed to extend room lifespan.');
    }
  };

  const handleRoomOptions = async () => {
    if (!activeRoom) return;
    const choice = prompt(
      'Room Options:\n1. Return to SecureBox Hub\n2. Play Retro Game Disguise\n3. Extend room lifespan (+24 hours)\n4. Wipe and self-destruct room\n\nEnter 1, 2, 3, or 4:'
    );

    if (choice === '1') {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
      setActiveRoom(null);
      setCryptoKey(null);
      setMessages([]);
      setScreenMode('hub');
    } else if (choice === '2') {
      setScreenMode('game');
    } else if (choice === '3') {
      await handleExtendRoom();
    } else if (choice === '4') {
      if (confirm('Are you sure you want to completely wipe this room? All history will self-destruct permanently on both devices.')) {
        const rId = activeRoom.roomId;
        await sendWipeSignal(rId);
        deleteRoom(rId);
        localStorage.removeItem(ACTIVE_ROOM_KEY);
        setMessages([]);
        setActiveRoom(null);
        setCryptoKey(null);
        alert('Room destroyed. Returning to SecureBox Hub.');
        setScreenMode('hub');
      }
    }
  };

  if (isDedicatedPage) {
    return (
      <>
        <SecureboxPage
          onLaunchApp={() => {
            window.history.pushState(null, '', '/');
            setIsDedicatedPage(false);
            setScreenMode('hub');
          }}
          onOpenQuickDrop={() => {
            setQuickDropTab('upload');
            setIsQuickDropOpen(true);
          }}
        />
        <QuickDropModal
          isOpen={isQuickDropOpen}
          onClose={() => {
            setIsQuickDropOpen(false);
            if (window.location.pathname.toLowerCase().includes('drop')) {
              window.history.replaceState(null, '', '/');
            }
          }}
          initialCode={quickDropCode}
          initialTab={quickDropTab}
        />
      </>
    );
  }



  return (
    <div style={{
      width: '100%',
      height: '100dvh',
      backgroundColor: Colors.bg.primary,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        flex: 1,
        width: '100%',
        maxWidth: 520,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: Colors.bg.primary,
        boxShadow: '0 0 32px rgba(0,0,0,0.06)',
      }}>
        {/* Screen 1: Brick Smash Retro Arcade Game Disguise */}
        {screenMode === 'game' && (
          <BrickSmashGame
            unreadCount={unreadCount}
            onOpenSecureboxPage={() => {
              window.history.pushState(null, '', '/Securebox');
              setIsDedicatedPage(true);
            }}
            onOpenQuickDrop={() => {
              setQuickDropTab('upload');
              setIsQuickDropOpen(true);
            }}
            onUnlockClick={() => {
              // Action when unlocked via Hub Password -> ALWAYS GO TO THE SECUREBOX HUB!
              pendingUnlockAction.current = () => {
                setScreenMode('hub');
              };
              setIsPinModalOpen(true);
            }}
          />
        )}

        {/* Screen 2: Room Hub */}
        {screenMode === 'hub' && (
          <RoomHub
            savedRooms={savedRooms}
            onCreateRoom={handleCreateRoom}
            onEnterRoom={(room) => {
              setMessages([]);
              enterRoom(room);
            }}
            onDeleteRoom={deleteRoom}
            onPlayGame={() => setScreenMode('game')}
            onOpenQuickDrop={() => {
              setQuickDropTab('upload');
              setIsQuickDropOpen(true);
            }}
          />
        )}

        {/* Screen 3: Guest Join (via link) */}
        {screenMode === 'join' && pendingJoin && (
          <JoinModal
            roomId={pendingJoin.roomId}
            onJoin={handleJoinRoom}
            onCancel={() => {
              setPendingJoin(null);
              setScreenMode('hub');
            }}
          />
        )}

        {/* Screen 4: Encrypted Chat */}
        {screenMode === 'chat' && activeRoom && (
          <div style={{
            flex: 1, minHeight: 0, height: '100%',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', position: 'relative',
          }}>
            <ChatHeader
              partnerName={activeRoom.partnerHandle || 'Waiting for partner...'}
              isOnline={isPartnerOnline}
              roomCreatedAt={activeRoom.createdAt}
              roomExpiresAt={activeRoom.expiresAt}
              onExtendRoom={handleExtendRoom}
              onHubClick={() => {
                localStorage.removeItem(ACTIVE_ROOM_KEY);
                setActiveRoom(null);
                setCryptoKey(null);
                setMessages([]);
                setScreenMode('hub');
              }}
              onGameClick={() => {
                setScreenMode('game');
                document.title = 'Brick Smash | Arcade Retro Game';
              }}
              onLockClick={() => {
                setScreenMode('game');
                pendingUnlockAction.current = () => setScreenMode('hub');
                setIsPinModalOpen(true);
              }}
              onOptionsClick={handleRoomOptions}
            />
            <ChatMessages messages={messages} typingUser={typingUser} />
            <Composer
              onSendMessage={handleSendMessage}
              onSendMedia={handleSendMedia}
              onTyping={handleTyping}
            />
          </div>
        )}

        {/* First-time Profile & Password Onboarding */}
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onComplete={(chosenHandle, hash) => {
            setIsOnboardingOpen(false);
            if (!pendingJoin) {
              setScreenMode('hub');
            }
          }}
        />

        {/* Hub Password Modal */}
        <PinModal
          isOpen={isPinModalOpen}
          hubKey={HUB_KEY}
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={() => {
            setIsPinModalOpen(false);
            if (pendingUnlockAction.current) {
              const act = pendingUnlockAction.current;
              pendingUnlockAction.current = null;
              act();
            } else {
              setScreenMode('hub');
            }
          }}
        />

        {/* QuickDrop Modal */}
        <QuickDropModal
          isOpen={isQuickDropOpen}
          onClose={() => {
            setIsQuickDropOpen(false);
            if (window.location.pathname.toLowerCase().includes('drop')) {
              window.history.replaceState(null, '', '/');
            }
          }}
          initialCode={quickDropCode}
          initialTab={quickDropTab}
        />

        {/* Share Modal */}
        {isShareModalOpen && (
          <ShareModal
            shareLink={shareLink}
            onClose={() => setIsShareModalOpen(false)}
            onOpenChat={() => {
              setIsShareModalOpen(false);
              if (activeRoom) enterRoom(activeRoom);
            }}
          />
        )}
      </div>
    </div>
  );
};
