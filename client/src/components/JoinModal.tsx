// client/src/components/JoinModal.tsx
// Guest Join Screen — shown when a partner opens an invite link
// Step 1 : enter display name
// Step 2 : enter 4-digit Room Secret PIN (must match what creator set)
// No hub password logic here — hub password setup is handled by PinModal after join.

import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface JoinModalProps {
  roomId: string;
  onJoin: (handle: string, pin: string) => void;
}

export const JoinModal: React.FC<JoinModalProps> = ({ roomId, onJoin }) => {
  const [handle, setHandle] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!handle.trim()) {
      setError('Please choose a name / handle.');
      return;
    }
    if (pin.trim().length !== 4 || !/^\d{4}$/.test(pin.trim())) {
      setError('Room PIN must be exactly 4 digits.');
      return;
    }

    setIsLoading(true);
    try {
      await onJoin(handle.trim(), pin.trim());
    } catch (_) {
      setError('Could not join room. Check the PIN and try again.');
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      backgroundColor: Colors.bg.primary,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        backgroundColor: Colors.bg.elevated,
        border: `1px solid ${Colors.borderStrong}`,
        borderRadius: 20,
        padding: 28,
        boxShadow: '0 8px 32px rgba(0,0,0,0.07)',
      }}>
        {/* Icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          backgroundColor: Colors.accent.soft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: Colors.accent.primary, marginBottom: 16,
        }}>
          <Lock size={22} />
        </div>

        <h2 style={{ fontSize: 19, fontWeight: 700, color: Colors.text.primary, marginBottom: 4 }}>
          Private Room Invite
        </h2>

        {/* Room ID badge */}
        <div style={{
          display: 'inline-block', fontSize: 11, fontFamily: 'monospace',
          color: Colors.text.placeholder,
          backgroundColor: Colors.bg.secondary,
          padding: '3px 10px', borderRadius: 6, marginBottom: 14,
        }}>
          Room: {roomId}
        </div>

        <p style={{ fontSize: 13, color: Colors.text.secondary, lineHeight: 1.5, marginBottom: 22 }}>
          You have been invited to a private 2-person room.
          Ask the creator for the <strong>4-digit Room PIN</strong> to unlock end-to-end encryption.
        </p>

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            backgroundColor: 'rgba(229,62,62,0.08)',
            border: '1px solid rgba(229,62,62,0.25)',
            color: '#C53030',
            fontSize: 13, fontWeight: 500, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Handle */}
          <div>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              color: Colors.text.secondary, marginBottom: 7,
              textTransform: 'uppercase', letterSpacing: '0.6px',
            }}>
              Your Name / Handle
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => { setHandle(e.target.value); setError(null); }}
              placeholder="e.g. Sam"
              maxLength={20}
              autoComplete="off"
              style={{
                width: '100%', height: 46, borderRadius: 12,
                backgroundColor: Colors.bg.primary,
                border: `1.5px solid ${Colors.borderStrong}`,
                padding: '0 14px', fontSize: 14,
                color: Colors.text.primary, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Room Secret PIN */}
          <div>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              color: Colors.text.secondary, marginBottom: 7,
              textTransform: 'uppercase', letterSpacing: '0.6px',
            }}>
              Room Secret PIN <span style={{ color: Colors.accent.primary }}>(4 digits)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  // Allow only digits, max 4
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(val);
                  setError(null);
                }}
                placeholder="••••"
                inputMode="numeric"
                maxLength={4}
                style={{
                  width: '100%', height: 46, borderRadius: 12,
                  backgroundColor: Colors.bg.primary,
                  border: `1.5px solid ${Colors.borderStrong}`,
                  padding: '0 44px 0 14px', fontSize: 20,
                  letterSpacing: showPin ? 'normal' : '0.4em',
                  color: Colors.text.primary, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: Colors.text.placeholder, cursor: 'pointer', padding: 2,
                }}
              >
                {showPin ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <div style={{ fontSize: 11, color: Colors.text.placeholder, marginTop: 5 }}>
              This PIN was created by the room creator and shared with you.
              It is <strong>different</strong> from your personal Hub Password.
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%', height: 48, borderRadius: 12,
              backgroundColor: isLoading ? Colors.accent.light : Colors.accent.primary,
              border: 'none', color: Colors.text.inverse,
              fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: isLoading ? 'wait' : 'pointer', marginTop: 4,
            }}
          >
            <span>{isLoading ? 'Joining...' : 'Join Room'}</span>
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
};
