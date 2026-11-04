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

// ─── Storage Key Constants (single source of truth) ─────────────────────────
// HUB_KEY  : personal device entrance password hash
// ROOMS_KEY: map of all saved rooms on this device
// Never allow room PIN creation to overwrite HUB_KEY
const HUB_KEY = 'securebox_hub_hash';
const ROOMS_KEY = 'securebox_rooms';
const ACTIVE_ROOM_KEY = 'securebox_active_room_id';

export const App: React.FC = () => {
  const [screenMode, setScreenMode] = useState<ScreenMode>('game');
  const [activeRoom, setActiveRoom] = useState<RoomMetadata | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [savedRooms, setSavedRooms] = useState<RoomMetadata[]>(() => {
    const raw = localStorage.getItem(ROOMS_KEY);
    return raw ? Object.values(JSON.parse(raw)) : [];
  });

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [pendingJoin, setPendingJoin] = useState<{ roomId: string; secretKey: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    const activeId = localStorage.getItem(ACTIVE_ROOM_KEY);
    if (!activeId) return 0;
    return parseInt(localStorage.getItem(`securebox_unread_count_${activeId}`) || '0', 10);
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUnlockAction = useRef<(() => void) | null>(null);

  // Reset unread count when entering chat
  useEffect(() => {
    if (screenMode === 'chat' && activeRoom) {
      setUnreadCount(0);
      localStorage.setItem(`securebox_unread_count_${activeRoom.roomId}`, '0');
    }
  }, [screenMode, activeRoom]);

  // Restore active room & cryptoKey silently on load (no URL involved)
  useEffect(() => {
    const activeId = localStorage.getItem(ACTIVE_ROOM_KEY);
    const stored = localStorage.getItem(ROOMS_KEY);
    const map = stored ? JSON.parse(stored) : {};

    if (activeId && map[activeId]) {
      const room = map[activeId] as RoomMetadata;
      const isStillValid =
        (room.expiresAt && Date.now() < room.expiresAt) ||
        (!room.expiresAt && Date.now() - (room.createdAt || 0) < 24 * 60 * 60 * 1000);
      if (isStillValid) {
        setActiveRoom(room);
        importSecretKey(room.secretKey)
          .then((key) => setCryptoKey(key))
          .catch(() => {});
      }
    }
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

      // Short link: #k9x2m4 — 6 clean chars, no = or &
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

  // ── STRICT CHAT ISOLATION: always flush messages when room changes ──
  useEffect(() => {
    // Always reset first so previous room messages never bleed into new room
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
  }, [activeRoom?.roomId]); // keyed on roomId, not the whole room object

  // handleIncomingPacket defined before useEffects that reference it
  const handleIncomingPacket = useCallback(
    async (packet: { id: string; sender: string; iv: string; data: string; timestamp?: number }) => {
      if (!cryptoKey || !activeRoom) return;
      if (packet.sender.toLowerCase() === activeRoom.myHandle.toLowerCase()) return;

      // Register partner handle from first message if not saved yet
      if (!activeRoom.partnerHandle && packet.sender) {
        const updated = { ...activeRoom, partnerHandle: packet.sender };
        saveRoom(updated);
        setActiveRoom(updated);
      }

      try {
        const decrypted = await decryptData(cryptoKey, { iv: packet.iv, data: packet.data });
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
            localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next));
          } catch (storageErr) {
            console.warn('LocalStorage save warning:', storageErr);
            try {
              localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next.slice(-25)));
            } catch (_) {}
          }
          return next;
        });

        if (screenMode !== 'chat') {
          setUnreadCount((prev) => {
            const next = prev + 1;
            if (activeRoom) {
              localStorage.setItem(`securebox_unread_count_${activeRoom.roomId}`, String(next));
            }
            return next;
          });
        }
      } catch (err) {
        console.warn('Failed to decrypt packet:', err);
      }
    },
    [cryptoKey, activeRoom]
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

    pullOffline(); // immediate on mount

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
      // Immediately flush any previous room's chat
      setMessages([]);
      setIsPartnerOnline(false);
      setTypingUser(null);

      const key = await importSecretKey(room.secretKey);
      setCryptoKey(key);
      setActiveRoom(room);
      localStorage.setItem(ACTIVE_ROOM_KEY, room.roomId);
      setScreenMode('chat');
      document.title = `Chat - ${room.partnerHandle || 'Private'}`;
    } catch (_) {
      alert('Failed to load room key.');
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

    // Flush messages before switching rooms
    setMessages([]);
    saveRoom(room);
    setActiveRoom(room);
    setCryptoKey(derivedKey);
    localStorage.setItem(ACTIVE_ROOM_KEY, roomId);

    // ★ NEVER write room PIN hash into hub password slot ★
    // Hub password (HUB_KEY) is only set by PinModal setup mode.

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

    // ★ NEVER write room PIN hash into hub password slot ★
    setMessages([]);
    saveRoom(room);
    setCryptoKey(derivedKey);
    localStorage.setItem(ACTIVE_ROOM_KEY, room.roomId);
    setPendingJoin(null);

    // After joining, check if this device has a hub password already set.
    // If not, ask them to set one AFTER they're in chat (non-blocking flow).
    // We enter the room immediately so they don't miss messages.
    setActiveRoom(room);
    setScreenMode('chat');
    document.title = `Chat - ${room.partnerHandle || 'Private'}`;

    // If guest has no hub password, prompt once after a short delay (non-blocking)
    if (!localStorage.getItem(HUB_KEY)) {
      setTimeout(() => {
        // Open PIN modal in "setup" mode so they can set their Hub Password
        pendingUnlockAction.current = null; // no action — just setup
        setIsPinModalOpen(true);
      }, 1500);
    }
  };

  // ─── Send Message ────────────────────────────────────────────────────────
  const handleSendMessage = async (text: string) => {
    if (!activeRoom || !cryptoKey) return;
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: activeRoom.myHandle,
      text,
      timestamp: Date.now(),
      isOutgoing: true,
    };

    setMessages((prev) => {
      const next = [...prev, newMsg];
      try {
        localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next));
      } catch (_) {
        try {
          localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next.slice(-25)));
        } catch (__) {}
      }
      return next;
    });

    const encrypted = await encryptData(cryptoKey, {
      text,
      media: null,
      timestamp: Date.now(),
      sender: activeRoom.myHandle,
    });

    await sendEncryptedMessage({
      roomId: activeRoom.roomId,
      sender: activeRoom.myHandle,
      recipient: activeRoom.partnerHandle,
      encryptedPayload: encrypted,
    });
  };

  // ─── Send Media ──────────────────────────────────────────────────────────
  const handleSendMedia = async (base64: string) => {
    if (!activeRoom || !cryptoKey) return;
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: activeRoom.myHandle,
      text: '',
      media: base64,
      timestamp: Date.now(),
      isOutgoing: true,
    };

    setMessages((prev) => {
      const next = [...prev, newMsg];
      try {
        localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next));
      } catch (_) {
        try {
          localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next.slice(-25)));
        } catch (__) {}
      }
      return next;
    });

    try {
      const encrypted = await encryptData(cryptoKey, {
        text: '',
        media: base64,
        timestamp: Date.now(),
        sender: activeRoom.myHandle,
      });

      await sendEncryptedMessage({
        roomId: activeRoom.roomId,
        sender: activeRoom.myHandle,
        recipient: activeRoom.partnerHandle,
        encryptedPayload: encrypted,
      });
    } catch (err) {
      console.error('Send encrypted photo error:', err);
      alert('Failed to transmit photo. Please try again.');
    }
  };

  const handleTyping = () => {
    if (!activeRoom) return;
    sendTypingStatus(activeRoom.roomId, activeRoom.myHandle, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(activeRoom.roomId, activeRoom.myHandle, false);
    }, 2000);
  };

  const handleExtendRoom = async () => {
    if (!activeRoom) return;
    const confirmExtend = confirm('Extend this room lifespan by another 24 hours?');
    if (!confirmExtend) return;

    const res = await extendRoomLifespan(activeRoom.roomId, 86400000);
    const updated: RoomMetadata = { ...activeRoom, expiresAt: res.newExpiresAt };
    saveRoom(updated);
    setActiveRoom(updated);
    alert('Room successfully extended by +24 hours!');
  };

  const handleRoomOptions = () => {
    if (!activeRoom) return;
    const choice = prompt(
      'ROOM OPTIONS:\n\n1: Copy Invite Link\n2: Return to Game\n3: Go to Room Hub\n4: Erase Chat History\n\nEnter number (1-4):'
    );
    if (choice === '1') {
      const link = `${window.location.origin + window.location.pathname}#${activeRoom.roomId}`;
      navigator.clipboard.writeText(link).then(() => alert('Short room link copied!'));
    } else if (choice === '2') {
      setScreenMode('game');
      document.title = 'Brick Smash | Arcade Retro Game';
    } else if (choice === '3') {
      setScreenMode('hub');
    } else if (choice === '4') {
      const wipe = confirm('Permanently wipe chat for both participants?');
      if (wipe) {
        sendWipeSignal(activeRoom.roomId);
        localStorage.removeItem(`room_chat_${activeRoom.roomId}`);
        setMessages([]);
      }
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      width: '100vw',
      height: '100dvh',
      backgroundColor: Colors.bg.primary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 640,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: Colors.bg.primary,
        borderLeft: `1px solid ${Colors.border}`,
        borderRight: `1px solid ${Colors.border}`,
        overflow: 'hidden',
      }}>

        {/* Screen 1: Brick Smash Game Camouflage */}
        {screenMode === 'game' && (
          <BrickSmashGame
            unreadCount={unreadCount}
            onUnlockClick={() => {
              pendingUnlockAction.current = () => {
                const activeId = localStorage.getItem(ACTIVE_ROOM_KEY);
                const stored = localStorage.getItem(ROOMS_KEY);
                const map = stored ? JSON.parse(stored) : {};

                let targetRoom = activeRoom || (activeId && map[activeId] ? map[activeId] : null);

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
              // Flush messages before entering a different room
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

        {/* Hub Password Modal (entrance lock) */}
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
              // Guest just set up their hub password — stay in chat
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
