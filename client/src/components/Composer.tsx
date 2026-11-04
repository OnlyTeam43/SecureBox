// client/src/components/Composer.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Colors } from '../theme/tokens';
import { Image, Send, Loader2, X, Reply } from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';
import { ChatMessage } from '../types';

interface ComposerProps {
  onSendMessage: (text: string, replyTo?: ChatMessage['replyTo']) => void;
  onSendMedia: (base64: string, replyTo?: ChatMessage['replyTo']) => void;
  onTyping: (isTyping: boolean) => void;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSendMessage, onSendMedia, onTyping, replyingTo, onCancelReply,
}) => {
  const [text, setText] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const typingActiveRef = useRef(false);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (replyingTo) {
      textInputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;
    const reply = replyingTo ? {
      id: replyingTo.id,
      sender: replyingTo.sender,
      text: replyingTo.text,
      media: replyingTo.media,
    } : undefined;
    onSendMessage(text.trim(), reply);
    setText('');
    onCancelReply();
    // stop typing signal
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      onTyping(false);
    }
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    // Fire typing start immediately (no debounce)
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      onTyping(true);
    }
    // Auto-stop after 2.5s inactivity
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      typingActiveRef.current = false;
      onTyping(false);
    }, 2500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setIsCompressing(true);
      const compressedBase64 = await compressImage(file, 1024, 0.72);
      if (compressedBase64) {
        const reply = replyingTo ? {
          id: replyingTo.id,
          sender: replyingTo.sender,
          text: replyingTo.text,
          media: replyingTo.media,
        } : undefined;
        onSendMedia(compressedBase64, reply);
        onCancelReply();
      }
    } catch (err) {
      alert('Could not prepare image. Please try again.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  // Cleanup on unmount
  useEffect(() => () => {
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
  }, []);

  return (
    <div style={{
      flexShrink: 0,
      backgroundColor: Colors.bg.elevated,
      borderTop: `1px solid ${Colors.border}`,
      zIndex: 20,
      boxSizing: 'border-box',
    }}>
      {/* Reply Preview Bar */}
      {replyingTo && (
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '8px 14px 4px',
          gap: 8,
          borderBottom: `1px solid ${Colors.border}`,
        }}>
          <Reply size={14} color={Colors.accent.primary} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: Colors.accent.primary }}>
              {replyingTo.isOutgoing ? 'You' : replyingTo.sender}
            </div>
            <div style={{ fontSize: 12, color: Colors.text.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {replyingTo.media && !replyingTo.text ? '📷 Photo' : replyingTo.text}
            </div>
          </div>
          <button
            onClick={onCancelReply}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: Colors.text.secondary, padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
      }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isCompressing}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            backgroundColor: Colors.bg.secondary,
            border: `1px solid ${Colors.border}`,
            color: isCompressing ? Colors.accent.primary : Colors.text.secondary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isCompressing ? 'wait' : 'pointer',
            opacity: isCompressing ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {isCompressing ? <Loader2 size={17} className="animate-spin" /> : <Image size={17} />}
        </button>

        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={textInputRef}
            type="text"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isCompressing ? 'Compressing photo...' : 'Encrypted message...'}
            style={{
              width: '100%', height: 42, borderRadius: 21,
              backgroundColor: Colors.bg.primary,
              border: `1px solid ${Colors.borderStrong}`,
              padding: '0 16px', fontSize: 14,
              color: Colors.text.primary, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          onClick={() => handleSubmit()}
          style={{
            width: 42, height: 42, borderRadius: '50%',
            backgroundColor: Colors.accent.primary, border: 'none',
            color: Colors.text.inverse, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(217, 119, 87, 0.3)', flexShrink: 0,
          }}
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  );
};
