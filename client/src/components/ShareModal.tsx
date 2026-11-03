// client/src/components/ShareModal.tsx
import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { Copy, Check, X, Link } from 'lucide-react';

interface ShareModalProps {
  shareLink: string;
  onClose: () => void;
  onOpenChat: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ shareLink, onClose, onOpenChat }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: Colors.bg.overlay,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        backgroundColor: Colors.bg.elevated,
        border: `1px solid ${Colors.borderStrong}`,
        borderRadius: 20,
        padding: 24,
        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'none',
            border: 'none',
            color: Colors.text.placeholder,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            backgroundColor: Colors.accent.soft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: Colors.accent.primary,
          }}>
            <Link size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: Colors.text.primary, margin: 0 }}>
              Room Link Created
            </h3>
            <span style={{ fontSize: 12, color: Colors.text.secondary }}>
              One-time private invite
            </span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: Colors.text.secondary, lineHeight: 1.45, marginBottom: 12 }}>
          Share this short link with your partner. They will enter your 4-digit Secret PIN to unlock and join the room.
        </p>

        <input
          type="text"
          readOnly
          value={shareLink}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: Colors.bg.secondary,
            border: `1px solid ${Colors.border}`,
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'monospace',
            color: Colors.text.primary,
            marginBottom: 16,
            boxSizing: 'border-box',
            userSelect: 'all',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleCopy}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              backgroundColor: Colors.accent.primary,
              border: 'none',
              color: Colors.text.inverse,
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Room Link'}</span>
          </button>

          <button
            onClick={onOpenChat}
            style={{
              width: '100%',
              height: 42,
              borderRadius: 10,
              backgroundColor: Colors.bg.secondary,
              border: `1px solid ${Colors.borderStrong}`,
              color: Colors.text.primary,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Open Chat Room Now
          </button>
        </div>
      </div>
    </div>
  );
};
