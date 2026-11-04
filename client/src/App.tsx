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
import { ShareModal } from './components/ShareModal';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessages } from './components/ChatMessages';
import { Composer } from './components/Composer';

// ─── Storage Key Constants ──────────────────────────────────────────────────
const HUB_KEY = 'securebox_hub_hash';
const ROOMS_KEY = 'securebox_rooms';
const ACTIVE_ROOM_KEY = 'securebox_active_room_id';

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
  const [screenMode, setScreenMode] = useState<ScreenMode>('game');
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

  // Restore active room & cryptoKey silently on load (auto-select most recent if activeId unset)
  useEffect(() => {
    const activeId = localStorage.getItem(ACTIVE_ROOM_KEY);
    const stored = localStorage.getItem(ROOMS_KEY);
    const map = stored ? JSON.parse(stored) : {};

    let targetRoom: RoomMetadata | null = null;
    if (activeId && map[activeId]) {
      targetRoom = map[activeId] as RoomMetadata;
    } else {
      const all = Object.values(map) as RoomMetadata[];
      if (all.length > 0) {
        all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        targetRoom = all[0];
      }
    }

    if (targetRoom) {
      const isStillValid =
        (targetRoom.expiresAt && Date.now() < targetRoom.expiresAt) ||
        (!targetRoom.expiresAt && Date.now() - (targetRoom.createdAt || 0) < 24 * 60 * 60 * 1000);
      if (isStillValid) {
        setActiveRoom(targetRoom);
        localStorage.setItem(ACTIVE_ROOM_KEY, targetRoom.roomId);
        importSecretKey(targetRoom.secretKey)
          .then((key) => setCryptoKey(key))
          .catch(() => {});
      }
    }
    // Update badge count on initial load
    setUnreadCount(getTotalUnreadCount());
  }, []);

  // Parse URL on load — handle invite link (#roomId) or plain game view
  useEffect(() => {
    const parseUrl = async () => {
      const rawHash = window.location.hash.slice(1).trim();

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
        setScreenMode('game');
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
          setScreenMode('game');
        }
      } else {
        // Brand new guest — go to join screen to enter room PIN
        setPendingJoin({ roomId, secretKey });
        setScreenMode('join');
      }
    };

    parseUrl();
  }, []);

  // Camouflage Auto-Lock
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && screenMode === 'chat') {
        setScreenMode('game');
        document.title = 'Brick Smash | Arcade Retro Game';
      }
    };

    let idleTimer: NodeJS.Timeout;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (screenMode === 'chat') {
          setScreenMode('game');
          document.title = 'Brick Smash | Arcade Retro Game';
        }
      }, 60000);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    ['touchstart', 'mousemove', 'keydown', 'click'].forEach((evt) => {
      window.addEventListener(evt, resetIdle, { passive: true });
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(idleTimer);
    };
  }, [screenMode]);

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
    const choice = prompt('Options:\n1. Extend room lifespan (+24 hours)\n2. Wipe and self-destruct room\n\nEnter 1 or 2:');

    if (choice === '1') {
      await handleExtendRoom();
    } else if (choice === '2') {
      if (confirm('Are you sure you want to completely wipe this room? All history will self-destruct permanently.')) {
        await sendWipeSignal(activeRoom.roomId);
        deleteRoom(activeRoom.roomId);
        setMessages([]);
        setActiveRoom(null);
        setScreenMode('game');
      }
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: Colors.bg.primary,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Screen 1: Brick Smash Retro Arcade Game Disguise */}
        {screenMode === 'game' && (
          <BrickSmashGame
            unreadCount={unreadCount}
            onUnlockClick={() => {
              // Action when unlocked via Hub Password
              pendingUnlockAction.current = () => {
                const activeId = localStorage.getItem(ACTIVE_ROOM_KEY);
                const stored = localStorage.getItem(ROOMS_KEY);
                const map = stored ? JSON.parse(stored) : {};

                let targetRoom = activeRoom || (activeId && map[activeId] ? map[activeId] : null);

                // If unread messages exist for another room, pick that room!
                for (const rId of Object.keys(map)) {
                  const unread = parseInt(localStorage.getItem(`securebox_unread_count_${rId}`) || '0', 10);
                  if (unread > 0) {
                    targetRoom = map[rId];
                    break;
                  }
                }

                if (!targetRoom) {
                  const rooms = Object.values(map) as RoomMetadata[];
                  if (rooms.length > 0) {
                    rooms.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
                    const recent = rooms[0];
                    const valid =
                      (recent.expiresAt && Date.now() < recent.expiresAt) ||
                      (!recent.expiresAt && Date.now() - (recent.createdAt || 0) < 24 * 60 * 60 * 1000);
                    if (valid) targetRoom = recent;
                  }
                }

                if (targetRoom) {
                  const valid =
                    (targetRoom.expiresAt && Date.now() < targetRoom.expiresAt) ||
                    (!targetRoom.expiresAt && Date.now() - (targetRoom.createdAt || 0) < 24 * 60 * 60 * 1000);
                  if (valid) {
                    enterRoom(targetRoom);
                    return;
                  }
                }

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
          />
        )}

        {/* Screen 3: Guest Join (via link) */}
        {screenMode === 'join' && pendingJoin && (
          <JoinModal
            roomId={pendingJoin.roomId}
            onJoin={handleJoinRoom}
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
              onGameClick={() => {
                setScreenMode('game');
                document.title = 'Brick Smash | Arcade Retro Game';
              }}
              onLockClick={() => {
                setScreenMode('game');
                pendingUnlockAction.current = () => setScreenMode('chat');
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
              if (screenMode !== 'chat') {
                setScreenMode(activeRoom ? 'chat' : 'hub');
              }
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
