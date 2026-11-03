// client/src/components/JoinModal.tsx
import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { Lock, ArrowRight } from 'lucide-react';

interface JoinModalProps {
  roomId: string;
  onJoin: (handle: string, pin: string) => void;
}

export const JoinModal: React.FC<JoinModalProps> = ({ roomId, onJoin }) => {
  const [handle, setHandle] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) {
      alert('Please choose a handle / name.');
      return;
    }
    if (pin.trim().length < 4) {
      alert('Please set a PIN of at least 4 digits.');
      return;
    }
    onJoin(handle.trim(), pin.trim());
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: Colors.bg.primary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        backgroundColor: Colors.bg.elevated,
        border: `1px solid ${Colors.borderStrong}`,
        borderRadius: 20,
        padding: 24,
        boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: Colors.accent.soft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: Colors.accent.primary,
          marginBottom: 16,
        }}>
          <Lock size={20} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.text.primary, marginBottom: 4 }}>
          Private Room Invite
        </h2>
        <div style={{
          display: 'inline-block',
          fontSize: 11,
          fontFamily: 'monospace',
          color: Colors.text.placeholder,
          backgroundColor: Colors.bg.secondary,
          padding: '2px 8px',
          borderRadius: 6,
          marginBottom: 14,
        }}>
          Room: {roomId.slice(0, 10)}...
        </div>

        <p style={{ fontSize: 13, color: Colors.text.secondary, lineHeight: 1.45, marginBottom: 18 }}>
          You’ve been invited to a private 2-person room. Enter your name and choose a disguise PIN to join.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: Colors.text.secondary, marginBottom: 6 }}>
              YOUR HANDLE
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. Sam"
              maxLength={20}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 10,
                backgroundColor: Colors.bg.primary,
                border: `1px solid ${Colors.borderStrong}`,
                padding: '0 14px',
                fontSize: 14,
                color: Colors.text.primary,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: Colors.text.secondary, marginBottom: 6 }}>
              CHOOSE YOUR PIN (4-6 DIGITS)
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              maxLength={6}
              inputMode="numeric"
              style={{
                width: '100%',
                height: 44,
                borderRadius: 10,
                backgroundColor: Colors.bg.primary,
                border: `1px solid ${Colors.borderStrong}`,
                padding: '0 14px',
                fontSize: 14,
                color: Colors.text.primary,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              height: 46,
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
              marginTop: 6,
            }}
          >
            <span>Join & Open Encrypted Chat</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
