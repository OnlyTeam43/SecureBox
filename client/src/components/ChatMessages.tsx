// client/src/components/ChatMessages.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Colors } from '../theme/tokens';
import { ChatMessage } from '../types';
import { Check, CheckCheck, ShieldCheck, Reply } from 'lucide-react';
import { ImageViewerModal } from './ImageViewerModal';

interface ChatMessagesProps {
  messages: ChatMessage[];
  typingUser: string | null;
  partnerLastSeen: number | null;
  onReply: (msg: ChatMessage) => void;
  onMessageVisible: (msgId: string) => void;
}

const TypingDots: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px' }}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: Colors.accent.primary,
          display: 'inline-block',
          animation: `typingPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }}
      />
    ))}
    <style>{`
      @keyframes typingPulse {
        0%, 60%, 100% { transform: scale(0.7); opacity: 0.4; }
        30% { transform: scale(1.1); opacity: 1; }
      }
    `}</style>
  </div>
);

const StatusTick: React.FC<{ status?: 'sent' | 'delivered' | 'seen' }> = ({ status }) => {
  if (!status || status === 'sent') {
    return <Check size={12} color={Colors.text.placeholder} />;
  }
  if (status === 'delivered') {
    return <CheckCheck size={12} color={Colors.text.placeholder} />;
  }
  // seen
  return <CheckCheck size={12} color={Colors.accent.primary} />;
};

const ReplyPreview: React.FC<{ replyTo: ChatMessage['replyTo']; myHandle: string }> = ({ replyTo, myHandle }) => {
  if (!replyTo) return null;
  const isMe = replyTo.sender === myHandle;
  return (
    <div style={{
      borderLeft: `3px solid ${Colors.accent.primary}`,
      paddingLeft: 8,
      marginBottom: 6,
      opacity: 0.8,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: Colors.accent.primary, marginBottom: 2 }}>
        {isMe ? 'You' : replyTo.sender}
      </div>
      {replyTo.media && !replyTo.text && (
        <div style={{ fontSize: 11, color: Colors.text.secondary }}>📷 Photo</div>
      )}
      {replyTo.text && (
        <div style={{
          fontSize: 12, color: Colors.text.secondary,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180,
        }}>
          {replyTo.text}
        </div>
      )}
    </div>
  );
};

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages, typingUser, partnerLastSeen, onReply, onMessageVisible,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Swipe-to-reply state
  const [swipeState, setSwipeState] = useState<{ id: string; x: number } | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const swipedRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUser]);

  // Notify when incoming messages become visible (for read receipts)
  useEffect(() => {
    const incoming = messages.filter((m) => !m.isOutgoing && m.status !== 'seen');
    incoming.forEach((m) => onMessageVisible(m.id));
  }, [messages.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent, msgId: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipedRef.current = msgId;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent, msgId: string) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dy > 20) return; // vertical scroll wins
    if (dx > 8 && dx < 80) {
      setSwipeState({ id: msgId, x: dx });
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent, msg: ChatMessage) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    setSwipeState(null);
    swipedRef.current = null;
    if (dx > 50) {
      onReply(msg);
    }
  }, [onReply]);

  const lastSeenStr = partnerLastSeen
    ? (() => {
        const diff = Date.now() - partnerLastSeen;
        if (diff < 60000) return 'last seen just now';
        if (diff < 3600000) return `last seen ${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `last seen ${Math.floor(diff / 3600000)}h ago`;
        return `last seen ${new Date(partnerLastSeen).toLocaleDateString()}`;
      })()
    : null;

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      backgroundColor: Colors.bg.chatBg,
    }}>
      {/* Encryption Badge */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: '6px 14px', borderRadius: 20,
        backgroundColor: Colors.accent.soft, border: `1px solid ${Colors.accent.light}`,
        color: Colors.accent.secondary, fontSize: 11, fontWeight: 500, margin: '0 auto 8px',
      }}>
        <ShieldCheck size={14} />
        <span>End-to-End Encrypted (AES-GCM-256) · Zero Server Storage</span>
      </div>

      {/* Messages */}
      {messages.map((msg, idx) => {
        const isOut = msg.isOutgoing;
        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const swipeX = (swipeState?.id === msg.id) ? swipeState.x : 0;
        const isLastOut = isOut && (idx === messages.length - 1 || !messages.slice(idx + 1).some(m => m.isOutgoing));

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: isOut ? 'flex-end' : 'flex-start',
              maxWidth: '82%',
              gap: 2,
              transform: `translateX(${swipeX}px)`,
              transition: swipeX === 0 ? 'transform 0.2s ease' : 'none',
              position: 'relative',
            }}
            onTouchStart={(e) => handleTouchStart(e, msg.id)}
            onTouchMove={(e) => handleTouchMove(e, msg.id)}
            onTouchEnd={(e) => handleTouchEnd(e, msg)}
          >
            {/* Reply arrow icon shown on swipe */}
            {swipeX > 20 && (
              <div style={{
                position: 'absolute', left: -32, top: '50%',
                transform: 'translateY(-50%)', opacity: Math.min(1, (swipeX - 20) / 30),
              }}>
                <Reply size={20} color={Colors.accent.primary} />
              </div>
            )}

            <div style={{
              padding: '9px 13px',
              borderRadius: 16,
              borderBottomRightRadius: isOut ? 4 : 16,
              borderBottomLeftRadius: !isOut ? 4 : 16,
              backgroundColor: isOut ? Colors.bubble.sent : Colors.bubble.received,
              border: `1px solid ${isOut ? Colors.bubble.sentBorder : Colors.bubble.receivedBorder}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              color: Colors.text.primary,
              fontSize: 14.5, lineHeight: 1.45, wordBreak: 'break-word',
            }}>
              {/* Reply preview */}
              {msg.replyTo && <ReplyPreview replyTo={msg.replyTo} myHandle={msg.sender} />}

              {msg.media && (
                <div
                  style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden', borderRadius: 12 }}
                  onClick={() => setSelectedImage(msg.media || null)}
                >
                  <img
                    src={msg.media}
                    alt="Encrypted attachment"
                    style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 12, display: 'block', marginBottom: msg.text ? 8 : 0 }}
                  />
                </div>
              )}
              {msg.text && <div>{msg.text}</div>}
            </div>

            {/* Time + ticks */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: Colors.text.placeholder,
              alignSelf: isOut ? 'flex-end' : 'flex-start',
              padding: '0 4px',
            }}>
              <span>{timeStr}</span>
              {isOut && <StatusTick status={msg.status} />}
            </div>
          </div>
        );
      })}

      {/* Typing indicator bubble */}
      {typingUser && (
        <div style={{
          alignSelf: 'flex-start',
          backgroundColor: Colors.bubble.received,
          border: `1px solid ${Colors.bubble.receivedBorder}`,
          borderRadius: 16, borderBottomLeftRadius: 4,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          marginTop: 2, maxWidth: 80,
        }}>
          <TypingDots />
        </div>
      )}

      <div ref={bottomRef} />
      <ImageViewerModal imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </div>
  );
};
