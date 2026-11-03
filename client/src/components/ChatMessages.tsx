// client/src/components/ChatMessages.tsx
import React, { useEffect, useRef } from 'react';
import { Colors } from '../theme/tokens';
import { ChatMessage } from '../types';
import { Check, ShieldCheck } from 'lucide-react';

interface ChatMessagesProps {
  messages: ChatMessage[];
  typingUser: string | null;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, typingUser }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      backgroundColor: Colors.bg.chatBg,
    }}>
      {/* Encryption Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 20,
        backgroundColor: Colors.accent.soft,
        border: `1px solid ${Colors.accent.light}`,
        color: Colors.accent.secondary,
        fontSize: 11,
        fontWeight: 500,
        margin: '0 auto 8px',
      }}>
        <ShieldCheck size={14} />
        <span>End-to-End Encrypted (AES-GCM-256) • Zero Server Storage</span>
      </div>

      {/* Messages */}
      {messages.map((msg) => {
        const isOut = msg.isOutgoing;
        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: isOut ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              gap: 3,
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 16,
                borderBottomRightRadius: isOut ? 4 : 16,
                borderBottomLeftRadius: !isOut ? 4 : 16,
                backgroundColor: isOut ? Colors.bubble.sent : Colors.bubble.received,
                border: `1px solid ${isOut ? Colors.bubble.sentBorder : Colors.bubble.receivedBorder}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                color: Colors.text.primary,
                fontSize: 14.5,
                lineHeight: 1.45,
                wordBreak: 'break-word',
              }}
            >
              {msg.media && (
                <img
                  src={msg.media}
                  alt="Encrypted attachment"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 260,
                    borderRadius: 12,
                    display: 'block',
                    marginBottom: msg.text ? 8 : 0,
                  }}
                />
              )}
              {msg.text && <div>{msg.text}</div>}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: Colors.text.placeholder,
              alignSelf: isOut ? 'flex-end' : 'flex-start',
              padding: '0 4px',
            }}>
              <span>{timeStr}</span>
              {isOut && <Check size={11} color={Colors.accent.primary} />}
            </div>
          </div>
        );
      })}

      {/* Typing Indicator */}
      {typingUser && (
        <div style={{
          fontSize: 12,
          color: Colors.accent.primary,
          fontStyle: 'italic',
          padding: '4px 8px',
        }}>
          {typingUser} is typing...
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
