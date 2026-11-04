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

const ReplyPreview: React.FC<{
  replyTo: ChatMessage['replyTo'];
  onClick?: () => void;
}> = ({ replyTo, onClick }) => {
  if (!replyTo) return null;
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        borderLeft: `3px solid ${Colors.accent.primary}`,
        padding: '5px 8px',
        marginBottom: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 4,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background-color 0.15s ease',
      }}
      title="Tap to jump to original message"
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: Colors.accent.primary, marginBottom: 2 }}>
        {replyTo.sender}
      </div>
      {replyTo.media && !replyTo.text && (
        <div style={{ fontSize: 11, color: Colors.text.secondary }}>📷 Photo</div>
      )}
      {replyTo.text && (
        <div style={{
          fontSize: 12,
          color: Colors.text.secondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 220,
        }}>
          {replyTo.text}
        </div>
      )}
    </div>
  );
};

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages, typingUser, onReply, onMessageVisible,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Swipe-to-reply state
  const [swipeState, setSwipeState] = useState<{ id: string; x: number } | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUser]);

  // Notify when incoming messages become visible (for read receipts)
  useEffect(() => {
    const incoming = messages.filter((m) => !m.isOutgoing && m.status !== 'seen');
    incoming.forEach((m) => onMessageVisible(m.id));
  }, [messages.length, onMessageVisible]);

  const scrollToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(msgId);
      setTimeout(() => setHighlightedId(null), 1800);
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, msgId: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent, msgId: string) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dy > 30) return; // user is scrolling vertically
    if (Math.abs(dx) > 6) {
      const clamped = dx > 0 ? Math.min(dx, 65) : Math.max(dx, -65);
      setSwipeState({ id: msgId, x: clamped });
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent, msg: ChatMessage) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    setSwipeState(null);
    if (Math.abs(dx) > 35 && dy < 35) {
      onReply(msg);
    }
  }, [onReply]);

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
      {messages.map((msg) => {
        const isOut = msg.isOutgoing;
        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const swipeX = (swipeState?.id === msg.id) ? swipeState.x : 0;
        const isHighlighted = highlightedId === msg.id;

        return (
          <div
            id={`msg-${msg.id}`}
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: isOut ? 'flex-end' : 'flex-start',
              maxWidth: '84%',
              gap: 2,
              transform: `translateX(${swipeX}px)`,
              transition: swipeX === 0 ? 'transform 0.2s ease, box-shadow 0.25s ease' : 'none',
              position: 'relative',
              borderRadius: 16,
              boxShadow: isHighlighted ? `0 0 0 2.5px ${Colors.accent.primary}, 0 4px 14px rgba(217, 119, 87, 0.35)` : undefined,
            }}
            onTouchStart={(e) => handleTouchStart(e, msg.id)}
            onTouchMove={(e) => handleTouchMove(e, msg.id)}
            onTouchEnd={(e) => handleTouchEnd(e, msg)}
          >
            {/* Reply icon indicator when dragging/swiping */}
            {Math.abs(swipeX) > 15 && (
              <div style={{
                position: 'absolute',
                left: swipeX > 0 ? -28 : undefined,
                right: swipeX < 0 ? -28 : undefined,
                top: '50%',
                transform: 'translateY(-50%)',
                opacity: Math.min(1, (Math.abs(swipeX) - 15) / 25),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Reply size={18} color={Colors.accent.primary} />
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
              {/* Linked Reply Preview */}
              {msg.replyTo && (
                <ReplyPreview
                  replyTo={msg.replyTo}
                  onClick={() => msg.replyTo?.id && scrollToMessage(msg.replyTo.id)}
                />
              )}

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

            {/* Time + Status Ticks + Quick Reply Button */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 10, color: Colors.text.placeholder,
              alignSelf: isOut ? 'flex-end' : 'flex-start',
              padding: '0 4px',
            }}>
              <span>{timeStr}</span>
              {isOut && <StatusTick status={msg.status} />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReply(msg);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  color: Colors.text.placeholder,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 4,
                  opacity: 0.7,
                  marginLeft: 2,
                }}
                title="Reply"
              >
                <Reply size={11} />
              </button>
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
