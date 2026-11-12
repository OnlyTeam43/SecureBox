// client/src/App.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Colors } from './theme/tokens';
import { RoomMetadata, ChatMessage, ScreenMode } from './types';
import {
  generateRoomId,
  generateSecretKey,
  importSecretKey,
  encryptData,
  decryptData,
  hashPin,
} from './services/crypto';
import {
  getSessionId,
  getOrCreateRoomState,
  sendEncryptedMessage,
  fetchAndClearOfflineMessages,
  subscribeToRoom,
  sendTypingStatus,
  sendWipeSignal,
  sendSeenReceipt,
  sendLastSeen,
} from './services/supabase';

import { BrickSmashGame } from './components/BrickSmashGame';
import { PinModal } from './components/PinModal';
import { RoomHub } from './components/RoomHub';
import { OnboardingModal } from './components/OnboardingModal';
import { ShareModal } from './components/ShareModal';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessages } from './components/ChatMessages';
import { Composer } from './components/Composer';
import { SecureboxPage } from './components/SecureboxPage';
import { DropboxPage } from './components/DropboxPage';
import { applyRouteSeo } from './utils/seo';

// ─── Storage Key Constants ──────────────────────────────────────────────────
const HUB_KEY = 'securebox_hub_hash';
const ROOMS_KEY = 'securebox_rooms';
const ACTIVE_ROOM_KEY = 'securebox_active_room_id';

const isDropRoute = (path: string, hash: string = ''): boolean => {
  const clean = path.toLowerCase().replace(/\/+$/, '');
  const cleanHash = hash.toLowerCase();
  return (
    clean === '/dropbox' ||
    clean.endsWith('/dropbox') ||
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
  const [isDropboxPage, setIsDropboxPage] = useState<boolean>(() =>
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

  const [isDedicatedPage, setIsDedicatedPage] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    return !isDropRoute(path, window.location.hash) && isSecureboxRoute(path);
  });

  const [screenMode, setScreenMode] = useState<ScreenMode>('hub');
  const screenModeRef = useRef<ScreenMode>(screenMode);
  screenModeRef.current = screenMode;

  const openDropboxPage = useCallback(
    (tab: 'upload' | 'retrieve' = 'upload', code: string = '') => {
      if (code) setQuickDropCode(code);
      setQuickDropTab(tab);
      setIsDedicatedPage(false);
      setIsDropboxPage(true);
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', '/dropbox');
      }
    },
    []
  );

  const openSecureboxPage = useCallback(() => {
    setIsDropboxPage(false);
    setIsDedicatedPage(true);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/Securebox');
    }
  }, []);

  const launchMainApp = useCallback(() => {
    setIsDropboxPage(false);
    setIsDedicatedPage(false);
    setScreenMode('hub');
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
  }, []);

  useEffect(() => {
    if (isDropboxPage) {
      applyRouteSeo('dropbox');
    } else if (isDedicatedPage) {
      applyRouteSeo('securebox');
    } else if (screenMode !== 'chat') {
      applyRouteSeo('home');
    }
  }, [isDropboxPage, isDedicatedPage, screenMode]);

  useEffect(() => {
    const handlePop = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const dropMatched = isDropRoute(path, hash);
      if (dropMatched) {
        const cleanHash = hash.slice(1);
        const p = new URLSearchParams(cleanHash.includes('=') ? cleanHash : '');
        const c = p.get('code');
        if (c) {
          setQuickDropCode(c);
          setQuickDropTab('retrieve');
        }
      }
      setIsDropboxPage(dropMatched);
      setIsDedicatedPage(!dropMatched && isSecureboxRoute(path));
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
  const [pendingInvite, setPendingInvite] = useState<{ roomId: string; secretKey: string } | null>(null);
  const [pinModalTitle, setPinModalTitle] = useState<string | undefined>();
  const [pinModalSubtitle, setPinModalSubtitle] = useState<string | undefined>();

  // Unread badge count connected directly across all rooms
  const [unreadCount, setUnreadCount] = useState<number>(() => getTotalUnreadCount());

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUnlockAction = useRef<(() => void) | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [partnerLastSeen, setPartnerLastSeen] = useState<number | null>(null);

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
      setActiveRoom(targetRoom);
      importSecretKey(targetRoom.secretKey)
        .then((key) => setCryptoKey(key))
        .catch(() => {});
    }
    // Update badge count on initial load
    setUnreadCount(getTotalUnreadCount());
  }, []);

  // Parse URL on load — handle invite link (#roomId) or plain game view
  useEffect(() => {
    const parseUrl = async () => {
      const rawHash = window.location.hash.slice(1).trim();

      // QuickDrop / Dropbox direct link (#code=... or #drop or legacy /drop /quickdrop)
      const lowerPath = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (
        rawHash.includes('code=') ||
        rawHash === 'drop' ||
        lowerPath === '/drop' ||
        lowerPath === '/quickdrop'
      ) {
        const p = new URLSearchParams(rawHash.includes('=') ? rawHash : '');
        const c = p.get('code');
        if (c) {
          setQuickDropCode(c);
          setQuickDropTab('retrieve');
        } else {
          setQuickDropTab('upload');
        }
        setIsDedicatedPage(false);
        setIsDropboxPage(true);
        window.history.replaceState(null, '', '/dropbox');
        return;
      }

      // Clear the URL hash immediately so refresh never re-triggers join
      if (rawHash) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      let roomId = '';
      let secretKey = '';

      if (rawHash.includes('_') && !rawHash.includes('&') && !rawHash.includes('=')) {
        const parts = rawHash.split('_');
        roomId = parts[0].toLowerCase();
        secretKey = parts[1] || '';
      } else if (rawHash.includes('=')) {
        const params = new URLSearchParams(rawHash);
        roomId = (params.get('room') || params.get('r') || params.get('id') || '').toLowerCase();
        secretKey = params.get('key') || params.get('k') || '';
      } else if (rawHash) {
        roomId = rawHash.toLowerCase();
      }

      if (!roomId) {
        return;
      }

      const stored = localStorage.getItem(ROOMS_KEY);
      const map = stored ? JSON.parse(stored) : {};

      if (map[roomId]) {
        // Existing saved room: verify it's still alive on the server first
        const room = map[roomId] as RoomMetadata;
        const state = await getOrCreateRoomState(roomId, room.myHandle, room.isCreator);
        if (state.destroyed || (!state.success && !room.isCreator)) {
          deleteRoom(roomId);
          alert('This room was destroyed by the creator. The invite link has expired.');
          return;
        }
        setPinModalTitle('Unlock Room');
        setPinModalSubtitle('Enter your Hub Password to open chat');
        pendingUnlockAction.current = () => enterRoom(room);
        setIsPinModalOpen(true);
      } else if (secretKey) {
        // Direct room invite via link click: verify room is still alive on server!
        const state = await getOrCreateRoomState(roomId, 'guest', false);
        if (state.destroyed || !state.success) {
          alert('This room has been destroyed by the creator. The invite link has expired.');
          return;
        }
        const hasProfile = !!localStorage.getItem('securebox_user_handle') && !!localStorage.getItem(HUB_KEY);
        if (!hasProfile) {
          // Brand new user from link: must complete handle & hub password onboarding first
          setPendingInvite({ roomId, secretKey });
          setIsOnboardingOpen(true);
        } else {
          // Returning user on this device: enter hub password to access room
          const userHandle = localStorage.getItem('securebox_user_handle') || 'Partner';
          setPinModalTitle('Unlock Secret Room Invite');
          setPinModalSubtitle('Enter your Hub Password to access this room');
          pendingUnlockAction.current = async () => {
            const joinState = await getOrCreateRoomState(roomId, userHandle, false);
            if (joinState.destroyed || !joinState.success) {
              alert('This room has been destroyed by the creator. The invite link has expired.');
              return;
            }
            const room: RoomMetadata = {
              roomId,
              secretKey,
              myHandle: userHandle,
              partnerHandle: joinState.partner || null,
              isCreator: false,
              createdAt: Date.now(),
            };
            saveRoom(room);
            await enterRoom(room);
          };
          setIsPinModalOpen(true);
        }
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
    async (packet: { id: string; sender: string; sessionId?: string; iv: string; data: string; timestamp?: number }) => {
      const room = activeRoomRef.current;
      const key = cryptoKeyRef.current;
      if (!key || !room) return;

      const mySess = getSessionId();
      if (packet.sessionId && packet.sessionId === mySess) return;

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
          status: 'delivered',
          replyTo: parsed.replyTo || null,
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

  const deleteRoom = (roomId: string, wipeOnServer: boolean = false) => {
    const raw = localStorage.getItem(ROOMS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const room = map[roomId] as RoomMetadata | undefined;

    // If the creator deletes the room, destroy it on the server so it expires for partner too
    if (wipeOnServer || room?.isCreator) {
      sendWipeSignal(roomId).catch(() => {});
    }

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

  // ─── Auto-Sync Hub Saved Rooms With Server ──────────────────────────────────
  useEffect(() => {
    if (screenMode !== 'hub') return;

    let isMounted = true;

    const syncHubRooms = async () => {
      const stored = localStorage.getItem(ROOMS_KEY);
      if (!stored) return;
      const map = JSON.parse(stored);
      let changed = false;

      for (const roomId of Object.keys(map)) {
        const room = map[roomId] as RoomMetadata;
        try {
          const state = await getOrCreateRoomState(roomId, room.myHandle, room.isCreator);
          if (state.destroyed || (!state.success && !room.isCreator)) {
            delete map[roomId];
            localStorage.removeItem(`room_chat_${roomId}`);
            localStorage.removeItem(`securebox_unread_count_${roomId}`);
            changed = true;
          }
        } catch (_) {}
      }

      if (changed && isMounted) {
        localStorage.setItem(ROOMS_KEY, JSON.stringify(map));
        setSavedRooms(Object.values(map));
        setUnreadCount(getTotalUnreadCount());
      }
    };

    syncHubRooms();
    const interval = setInterval(syncHubRooms, 3000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') syncHubRooms();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [screenMode]);

  // ─── Real-time subscription ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoom || !cryptoKey) return;
    const mySess = getSessionId();

    const channel = subscribeToRoom(activeRoom.roomId, activeRoom.myHandle, mySess, {
      onMessage: (payload) => handleIncomingPacket(payload),
      onTyping: ({ sender, isTyping }) => {
        setTypingUser(isTyping ? sender : null);
      },
      onPresenceChange: (activeUsers) => {
        const mySessId = getSessionId();
        const otherUser = activeUsers.find((u) => u.sessionId !== mySessId);
        if (otherUser) {
          if (!activeRoom.partnerHandle) {
            const updated = { ...activeRoom, partnerHandle: otherUser.handle };
            saveRoom(updated);
            setActiveRoom(updated);
          }
          setIsPartnerOnline(true);
        } else {
          setIsPartnerOnline(false);
        }
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
    const mySess = getSessionId();

    const pullOfflineAndCheckPartner = async () => {
      // 1. Fetch and clear offline queued messages
      const packets = await fetchAndClearOfflineMessages(activeRoom.roomId, mySess);
      packets.forEach((p) => handleIncomingPacket({ ...p, sessionId: '' }));

      // 2. Discover partner handle and check if creator destroyed the room
      try {
        const state = await getOrCreateRoomState(
          activeRoom.roomId,
          activeRoom.myHandle,
          activeRoom.isCreator
        );
        if (state.destroyed || (!state.success && !activeRoom.isCreator)) {
          const targetId = activeRoom.roomId;
          deleteRoom(targetId);
          localStorage.removeItem(ACTIVE_ROOM_KEY);
          setMessages([]);
          setActiveRoom(null);
          setCryptoKey(null);
          alert('This room was destroyed by the creator and completely wiped.');
          setScreenMode('hub');
          return;
        }
        if (state.partner) {
          const cur = activeRoomRef.current;
          if (cur && !cur.partnerHandle) {
            const updated = { ...cur, partnerHandle: state.partner };
            saveRoom(updated);
            setActiveRoom(updated);
          }
        }
      } catch (_) {}
    };

    pullOfflineAndCheckPartner();

    const ms = screenMode === 'chat' ? 2500 : 6000;
    const interval = setInterval(pullOfflineAndCheckPartner, ms);

    const onVisible = () => {
      if (document.visibilityState === 'visible') pullOfflineAndCheckPartner();
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

  // ─── Create Room (No Room PIN - Pure 256-bit AES-GCM Direct Access) ─────────
  const handleCreateRoom = async (handle: string) => {
    const roomId = generateRoomId();
    const secretKey = await generateSecretKey();
    const key = await importSecretKey(secretKey);

    await getOrCreateRoomState(roomId, handle, true);

    const room: RoomMetadata = {
      roomId,
      secretKey,
      myHandle: handle,
      partnerHandle: null,
      isCreator: true,
      createdAt: Date.now(),
    };

    setMessages([]);
    saveRoom(room);
    setActiveRoom(room);
    setCryptoKey(key);
    localStorage.setItem(ACTIVE_ROOM_KEY, roomId);

    // Auto-enter chat room immediately
    setScreenMode('chat');

    // Ultra-compact invite link (only 29 chars total: #roomId_secretKey)
    const base = window.location.origin + window.location.pathname;
    setShareLink(`${base}#${roomId}_${secretKey}`);
    setIsShareModalOpen(true);
  };

  // ─── Send Message ────────────────────────────────────────────────────────
  const handleSendMessage = async (text: string, replyTo?: ChatMessage['replyTo']) => {
    if (!activeRoom || !cryptoKey) return;
    const isOnline = isPartnerOnline;
    const payload = JSON.stringify({ text, replyTo: replyTo || null });

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
        status: 'sent',
        replyTo: replyTo || null,
      };

      setMessages((prev) => {
        const next = [...prev, newMsg];
        try {
          localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next));
        } catch (_) {}
        return next;
      });

      const mySess = getSessionId();
      await sendEncryptedMessage({
        roomId: activeRoom.roomId,
        sender: activeRoom.myHandle,
        sessionId: mySess,
        encryptedPayload: encrypted,
      });
    } catch (err) {
      alert('Failed to encrypt or deliver message.');
    }
  };

  // ─── Send Media ──────────────────────────────────────────────────────────
  const handleSendMedia = async (mediaDataUrl: string, replyTo?: ChatMessage['replyTo']) => {
    if (!activeRoom || !cryptoKey) return;
    const isOnline = isPartnerOnline;
    const payload = JSON.stringify({ media: mediaDataUrl, replyTo: replyTo || null });

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
        status: 'sent',
        replyTo: replyTo || null,
      };

      setMessages((prev) => {
        const next = [...prev, newMsg];
        try {
          localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next));
        } catch (_) {}
        return next;
      });

      const mySess = getSessionId();
      await sendEncryptedMessage({
        roomId: activeRoom.roomId,
        sender: activeRoom.myHandle,
        sessionId: mySess,
        encryptedPayload: encrypted,
      });
    } catch (err) {
      alert('Failed to encrypt or deliver photo.');
    }
  };

  // ─── Typing indicator ────────────────────────────────────────────────────
  const handleTyping = () => {
    if (!activeRoom) return;
    const mySess = getSessionId();
    sendTypingStatus(activeRoom.roomId, activeRoom.myHandle, mySess, true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (activeRoom) {
        sendTypingStatus(activeRoom.roomId, activeRoom.myHandle, mySess, false);
      }
    }, 2000);
  };

  // ─── Wipe and Self-Destruct Room ──────────────────────────────────────────
  const handleWipeRoom = async () => {
    if (!activeRoom) return;
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
  };

  if (isDropboxPage) {
    return (
      <DropboxPage
        initialCode={quickDropCode}
        initialTab={quickDropTab}
        onLaunchApp={launchMainApp}
        onOpenSecureboxPage={openSecureboxPage}
      />
    );
  }

  if (isDedicatedPage) {
    return (
      <SecureboxPage
        onLaunchApp={launchMainApp}
        onOpenQuickDrop={() => openDropboxPage('upload')}
      />
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
            onOpenSecureboxPage={openSecureboxPage}
            onOpenQuickDrop={() => openDropboxPage('upload')}
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
            onEnterRoom={async (room) => {
              const state = await getOrCreateRoomState(room.roomId, room.myHandle, room.isCreator);
              if (state.destroyed || (!state.success && !room.isCreator)) {
                deleteRoom(room.roomId);
                alert('This room was destroyed by the creator and has been removed from your saved rooms.');
                return;
              }
              setMessages([]);
              enterRoom(room);
            }}
            onDeleteRoom={(rId) => deleteRoom(rId, true)}
            onPlayGame={() => setScreenMode('game')}
            onOpenQuickDrop={() => openDropboxPage('upload')}
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
              partnerLastSeen={partnerLastSeen}
              typingUser={typingUser}
              onHubClick={() => {
                localStorage.removeItem(ACTIVE_ROOM_KEY);
                setActiveRoom(null);
                setCryptoKey(null);
                setMessages([]);
                setScreenMode('hub');
              }}
              onGameClick={() => {
                setScreenMode('game');
                applyRouteSeo('home');
              }}
              onLockClick={() => {
                setScreenMode('game');
                pendingUnlockAction.current = () => setScreenMode('hub');
                setIsPinModalOpen(true);
              }}
              onWipeClick={handleWipeRoom}
            />
            <ChatMessages
                messages={messages}
                typingUser={typingUser}
                partnerLastSeen={partnerLastSeen}
                onReply={(msg) => setReplyingTo(msg)}
                onMessageVisible={(msgId) => {
                  const mySess = getSessionId();
                  sendSeenReceipt(activeRoom.roomId, mySess, [msgId]);
                  sendLastSeen(activeRoom.roomId, mySess);
                }}
              />
            <Composer
              onSendMessage={handleSendMessage}
              onSendMedia={handleSendMedia}
              onTyping={handleTyping}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
          </div>
        )}

        {/* First-time Profile & Password Onboarding */}
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onComplete={async (chosenHandle) => {
            setIsOnboardingOpen(false);
            if (pendingInvite) {
              const invite = pendingInvite;
              setPendingInvite(null);
              const state = await getOrCreateRoomState(invite.roomId, chosenHandle, false);
              if (state.destroyed || !state.success) {
                alert('This room has been destroyed by the creator. The invite link has expired.');
                setScreenMode('hub');
                return;
              }
              const room: RoomMetadata = {
                roomId: invite.roomId,
                secretKey: invite.secretKey,
                myHandle: chosenHandle,
                partnerHandle: state.partner || null,
                isCreator: false,
                createdAt: Date.now(),
              };
              saveRoom(room);
              await enterRoom(room);
            } else {
              setScreenMode('hub');
            }
          }}
        />

        {/* Hub Password Modal */}
        <PinModal
          isOpen={isPinModalOpen}
          hubKey={HUB_KEY}
          title={pinModalTitle}
          subtitle={pinModalSubtitle}
          onClose={() => {
            setIsPinModalOpen(false);
            setPinModalTitle(undefined);
            setPinModalSubtitle(undefined);
          }}
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
