// client/src/App.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Colors } from './theme/tokens';
import { RoomMetadata, ChatMessage, ScreenMode } from './types';
import {
  generateSecretKey,
  generateRoomId,
  importSecretKey,
  encryptData,
  decryptData,
  hashPin,
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

export const App: React.FC = () => {
  const [screenMode, setScreenMode] = useState<ScreenMode>('game');
  const [activeRoom, setActiveRoom] = useState<RoomMetadata | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [savedRooms, setSavedRooms] = useState<RoomMetadata[]>(() => {
    const raw = localStorage.getItem('securebox_rooms');
    return raw ? Object.values(JSON.parse(raw)) : [];
  });

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [pendingJoin, setPendingJoin] = useState<{ roomId: string; secretKey: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    const activeId = localStorage.getItem('securebox_active_room_id');
    if (!activeId) return 0;
    return parseInt(localStorage.getItem(`securebox_unread_count_${activeId}`) || '0', 10);
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pendingUnlockAction = useRef<(() => void) | null>(null);

  // Reset unread count to 0 upon entering chat
  useEffect(() => {
    if (screenMode === 'chat' && activeRoom) {
      setUnreadCount(0);
      localStorage.setItem(`securebox_unread_count_${activeRoom.roomId}`, '0');
    }
  }, [screenMode, activeRoom]);

  // Restore active room & cryptoKey in background on load
  useEffect(() => {
    const activeId = localStorage.getItem('securebox_active_room_id');
    const stored = localStorage.getItem('securebox_rooms');
    const map = stored ? JSON.parse(stored) : {};

    if (activeId && map[activeId]) {
      const room = map[activeId] as RoomMetadata;
      const isStillValid =
        Date.now() - (room.createdAt || 0) < 24 * 60 * 60 * 1000 ||
        (room.expiresAt && Date.now() < room.expiresAt);
      if (isStillValid) {
        setActiveRoom(room);
        importSecretKey(room.secretKey)
          .then((key) => setCryptoKey(key))
          .catch(() => {});
      }
    }
  }, []);

  // Parse URL on load
  useEffect(() => {
    const parseUrl = async () => {
      const hash = window.location.hash.slice(1);
      const search = window.location.search.slice(1);
      const params = new URLSearchParams(hash.includes('=') ? hash : search);

      const roomId = params.get('id') || params.get('room');
      const secretKey = params.get('key') || params.get('k');

      if (roomId && secretKey) {
        const stored = localStorage.getItem('securebox_rooms');
        const map = stored ? JSON.parse(stored) : {};
        if (map[roomId]) {
          // Member returning
          const room = map[roomId];
          if (Date.now() - (room.createdAt || 0) < 24 * 60 * 60 * 1000) {
            pendingUnlockAction.current = () => enterRoom(room);
            setIsPinModalOpen(true);
          } else {
            alert('This room has expired (24 hours have passed).');
            setScreenMode('hub');
          }
        } else {
          // Guest onboarding
          setPendingJoin({ roomId, secretKey });
          setScreenMode('join');
        }
      } else {
        // Disguised as Brick Smash by default!
        setScreenMode('game');
      }
    };

    parseUrl();
  }, []);

  // Camouflage Auto-Lock (Visibility API & Tab switch)
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

  // Load chat messages when activeRoom changes
  useEffect(() => {
    if (!activeRoom) {
      setMessages([]);
      return;
    }

    const key = `room_chat_${activeRoom.roomId}`;
    const local = localStorage.getItem(key);
    if (local) {
      setMessages(JSON.parse(local));
    }
  }, [activeRoom]);

  // Real-time Supabase Subscription & Ephemeral Queue Fetch
  useEffect(() => {
    if (!activeRoom || !cryptoKey) return;

    // Fetch and clear offline relay messages
    fetchAndClearOfflineMessages(activeRoom.roomId, activeRoom.myHandle).then((offlinePackets) => {
      offlinePackets.forEach((p) => handleIncomingPacket(p));
    });

    const channel = subscribeToRoom(activeRoom.roomId, activeRoom.myHandle, {
      onMessage: (payload) => {
        handleIncomingPacket(payload);
      },
      onTyping: ({ sender, isTyping }) => {
        setTypingUser(isTyping ? sender : null);
      },
      onPresenceChange: (activeUsers) => {
        const cleanPartner = (activeRoom.partnerHandle || '').toLowerCase();
        const isOnline = activeUsers.some((u) => u.toLowerCase() === cleanPartner);
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
      try {
        channel.unsubscribe();
      } catch (_) {}
    };
  }, [activeRoom, cryptoKey]);

  const handleIncomingPacket = useCallback(
    async (packet: { id: string; sender: string; iv: string; data: string; timestamp?: number }) => {
      if (!cryptoKey || !activeRoom) return;
      if (packet.sender.toLowerCase() === activeRoom.myHandle.toLowerCase()) return;

      // Update partner handle if not registered yet
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
          localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next));
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

  const saveRoom = (room: RoomMetadata) => {
    const raw = localStorage.getItem('securebox_rooms');
    const map = raw ? JSON.parse(raw) : {};
    map[room.roomId] = room;
    localStorage.setItem('securebox_rooms', JSON.stringify(map));
    setSavedRooms(Object.values(map));
  };

  const deleteRoom = (roomId: string) => {
    const raw = localStorage.getItem('securebox_rooms');
    const map = raw ? JSON.parse(raw) : {};
    delete map[roomId];
    localStorage.setItem('securebox_rooms', JSON.stringify(map));
    localStorage.removeItem(`room_chat_${roomId}`);
    setSavedRooms(Object.values(map));
  };

  const enterRoom = async (room: RoomMetadata) => {
    try {
      const key = await importSecretKey(room.secretKey);
      setCryptoKey(key);
      setActiveRoom(room);
      localStorage.setItem('securebox_active_room_id', room.roomId);
      setScreenMode('chat');
      document.title = `Chat - ${room.partnerHandle || 'Private'}`;
    } catch (_) {
      alert('Failed to load room key.');
    }
  };

  // Actions
  const handleCreateRoom = async (handle: string, pin: string) => {
    const pHash = await hashPin(pin);
    localStorage.setItem('securebox_pin_hash', pHash);

    const roomId = generateRoomId();
    const secretKey = await generateSecretKey();

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
    };

    saveRoom(room);
    setActiveRoom(room);
    localStorage.setItem('securebox_active_room_id', roomId);

    const base = window.location.origin + window.location.pathname;
    const link = `${base}#id=${roomId}&key=${secretKey}`;
    setShareLink(link);
    setIsShareModalOpen(true);
  };

  const handleJoinRoom = async (handle: string, pin: string) => {
    if (!pendingJoin) return;
    const pHash = await hashPin(pin);

    const state = await getOrCreateRoomState(pendingJoin.roomId, handle, false, pHash);
    if (!state.success) {
      alert(state.error || 'Failed to join room.');
      return;
    }

    // Save verified PIN so partner can unlock the game camouflage with the same PIN
    localStorage.setItem('securebox_pin_hash', pHash);

    const room: RoomMetadata = {
      roomId: pendingJoin.roomId,
      secretKey: pendingJoin.secretKey,
      myHandle: handle,
      partnerHandle: state.partner || 'Partner',
      isCreator: false,
      createdAt: Date.now(),
    };

    saveRoom(room);
    setActiveRoom(room);
    localStorage.setItem('securebox_active_room_id', room.roomId);
    setPendingJoin(null);
    enterRoom(room);
  };

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
      localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next));
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
      localStorage.setItem(`room_chat_${activeRoom.roomId}`, JSON.stringify(next));
      return next;
    });

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
    const updated: RoomMetadata = {
      ...activeRoom,
      expiresAt: res.newExpiresAt,
    };
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
      const base = window.location.origin + window.location.pathname;
      const link = `${base}#id=${activeRoom.roomId}&key=${activeRoom.secretKey}`;
      navigator.clipboard.writeText(link).then(() => alert('Room link copied!'));
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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
                // Return to active 24-hour room anytime after minimise
                const activeId = localStorage.getItem('securebox_active_room_id');
                const stored = localStorage.getItem('securebox_rooms');
                const map = stored ? JSON.parse(stored) : {};

                let targetRoom = activeRoom || (activeId && map[activeId] ? map[activeId] : null);

                if (!targetRoom) {
                  const rooms = Object.values(map) as RoomMetadata[];
                  if (rooms.length > 0) {
                    rooms.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
                    const recent = rooms[0];
                    if (Date.now() - (recent.createdAt || 0) < 24 * 60 * 60 * 1000) {
                      targetRoom = recent;
                    }
                  }
                }

                if (targetRoom && Date.now() - (targetRoom.createdAt || 0) < 24 * 60 * 60 * 1000) {
                  enterRoom(targetRoom);
                } else {
                  setScreenMode('hub');
                }
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
            onEnterRoom={(room) => enterRoom(room)}
            onDeleteRoom={deleteRoom}
            onPlayGame={() => setScreenMode('game')}
          />
        )}

        {/* Screen 3: Guest Join */}
        {screenMode === 'join' && pendingJoin && (
          <JoinModal
            roomId={pendingJoin.roomId}
            onJoin={handleJoinRoom}
          />
        )}

        {/* Screen 4: Encrypted Chat */}
        {screenMode === 'chat' && activeRoom && (
          <div style={{
            flex: 1,
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
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

        {/* PIN Modal */}
        <PinModal
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          onSuccess={() => {
            setIsPinModalOpen(false);
            if (pendingUnlockAction.current) {
              const act = pendingUnlockAction.current;
              pendingUnlockAction.current = null;
              act();
            } else {
              setScreenMode(activeRoom ? 'chat' : 'hub');
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
