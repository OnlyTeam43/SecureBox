// client/src/components/JoinModal.tsx
// Guest Join Screen — shown when a partner opens an invite link
// Step 1 : enter display name (prefilled with remembered @handle)
// Step 2 : enter 4-digit Room Secret PIN (must match what creator set)

import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { Lock, ArrowRight, Eye, EyeOff, ArrowLeft, UserCheck } from 'lucide-react';

interface JoinModalProps {
  roomId: string;
  onJoin: (handle: string, pin: string) => void;
  onCancel?: () => void;
}

export const JoinModal: React.FC<JoinModalProps> = ({ roomId, onJoin, onCancel }) => {
  const [handle, setHandle] = useState(() => {
    return localStorage.getItem('securebox_user_handle') || '';
  });
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanHandle = handle.replace(/^@+/, '').trim();
    if (!cleanHandle) {
      setError('Please choose a name / handle.');
      return;
    }
    if (pin.trim().length !== 4 || !/^\d{4}$/.test(pin.trim())) {
      setError('Room PIN must be exactly 4 digits.');
      return;
    }

    localStorage.setItem('securebox_user_handle', cleanHandle);
    setIsLoading(true);
    try {
      await onJoin(cleanHandle, pin.trim());
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
        {/* Top actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: Colors.accent.soft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: Colors.accent.primary,
          }}>
            <Lock size={22} />
          </div>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 10px', borderRadius: 8,
                backgroundColor: Colors.bg.secondary,
                border: `1px solid ${Colors.border}`,
                color: Colors.text.secondary,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <ArrowLeft size={13} />
              <span>Back to Hub</span>
            </button>
          )}
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

        <p style={{ fontSize: 13, color: Colors.text.secondary, lineHeight: 1.5, marginBottom: 20 }}>
          You have been invited to a private 2-person room.
          Enter your partner's <strong>4-digit Room PIN</strong> to unlock end-to-end encryption.
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
              Your Display Handle
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{
                position: 'absolute', left: 14,
                fontSize: 14, fontWeight: 700, color: Colors.accent.primary,
                userSelect: 'none',
              }}>
                @
              </span>
              <input
                type="text"
                value={handle}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/^@+/, '').slice(0, 20);
                  setHandle(cleaned);
                  setError(null);
                }}
                placeholder="Alex"
                maxLength={20}
                autoComplete="off"
                style={{
                  width: '100%', height: 46, borderRadius: 12,
                  backgroundColor: Colors.bg.primary,
                  border: `1.5px solid ${Colors.borderStrong}`,
                  padding: '0 14px 0 32px', fontSize: 14, fontWeight: 600,
                  color: Colors.text.primary, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {handle.trim() && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11.5, color: Colors.accent.primary, fontWeight: 600, marginTop: 5,
              }}>
                <UserCheck size={12} />
                <span>Joining as @{handle.trim()}</span>
              </div>
            )}
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
              Enter the 4-digit PIN shared by the room creator.
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
