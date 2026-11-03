// client/src/components/Composer.tsx
import React, { useState, useRef } from 'react';
import { Colors } from '../theme/tokens';
import { Image, Send } from 'lucide-react';

interface ComposerProps {
  onSendMessage: (text: string) => void;
  onSendMedia: (base64: string) => void;
  onTyping: () => void;
}

export const Composer: React.FC<ComposerProps> = ({ onSendMessage, onSendMedia, onTyping }) => {
  const [text, setText] = useState('');
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      alert('Please select an image under 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) onSendMedia(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div style={{
      padding: '10px 16px 14px',
      backgroundColor: Colors.bg.elevated,
      borderTop: `1px solid ${Colors.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
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
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          backgroundColor: Colors.bg.secondary,
          border: `1px solid ${Colors.border}`,
          color: Colors.text.secondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        title="Attach image"
      >
        <Image size={17} />
      </button>

      {/* Input Field */}
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Encrypted message..."
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
