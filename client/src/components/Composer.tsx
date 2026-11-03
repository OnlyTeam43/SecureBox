// client/src/components/Composer.tsx
import React, { useState, useRef } from 'react';
import { Colors } from '../theme/tokens';
import { Image, Send, Loader2 } from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';

interface ComposerProps {
  onSendMessage: (text: string) => void;
  onSendMedia: (base64: string) => void;
  onTyping: () => void;
}

export const Composer: React.FC<ComposerProps> = ({ onSendMessage, onSendMedia, onTyping }) => {
  const [text, setText] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else {
      onTyping();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      // Downscale and compress image to high-clarity JPEG under 90KB
      // Ensures instant delivery across WebSockets & Supabase Realtime limits
      const compressedBase64 = await compressImage(file, 1024, 0.72);
      if (compressedBase64) {
        onSendMedia(compressedBase64);
      }
    } catch (err) {
      console.error('Image compression failed:', err);
      alert('Could not prepare image for encrypted transmission. Please try again.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{
      flexShrink: 0,
      padding: '10px 14px',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
      backgroundColor: Colors.bg.elevated,
      borderTop: `1px solid ${Colors.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      zIndex: 20,
      boxSizing: 'border-box',
    }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Attachment Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isCompressing}
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          backgroundColor: Colors.bg.secondary,
          border: `1px solid ${Colors.border}`,
          color: isCompressing ? Colors.accent.primary : Colors.text.secondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isCompressing ? 'wait' : 'pointer',
          opacity: isCompressing ? 0.7 : 1,
        }}
        title="Attach image"
      >
        {isCompressing ? <Loader2 size={17} className="animate-spin" /> : <Image size={17} />}
      </button>

      {/* Input Field */}
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isCompressing ? 'Compressing photo...' : 'Encrypted message...'}
          style={{
            width: '100%',
            height: 42,
            borderRadius: 21,
            backgroundColor: Colors.bg.primary,
            border: `1px solid ${Colors.borderStrong}`,
            padding: '0 16px',
            fontSize: 14,
            color: Colors.text.primary,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Send Button */}
      <button
        onClick={() => handleSubmit()}
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          backgroundColor: Colors.accent.primary,
          border: 'none',
          color: Colors.text.inverse,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(217, 119, 87, 0.3)',
        }}
        title="Send"
      >
        <Send size={17} />
      </button>
    </div>
  );
};
