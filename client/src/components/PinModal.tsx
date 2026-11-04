// client/src/components/PinModal.tsx
// Hub Entrance Password Modal
// ─────────────────────────────────────────────────────────────────────────────
// This modal ONLY manages the hub entrance password stored in hubKey.
// It has ZERO knowledge of room PINs or room state.
// Two modes:
//   • Setup mode  — no password exists yet → user creates it (typed twice)
//   • Unlock mode — password exists         → user enters it to unlock
// Resetting the hub password NEVER touches rooms or chat history.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { Colors } from '../theme/tokens';
import { hashPin } from '../services/crypto';
import { Lock, X, Eye, EyeOff, RotateCcw, Check } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  /** localStorage key to read/write the hub password hash. Passed from App. */
  hubKey: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({ isOpen, hubKey, onClose, onSuccess }) => {
  const [phase, setPhase] = useState<'unlock' | 'setup' | 'confirm'>('unlock');
  const [input, setInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  // Determine initial phase every time modal opens
  useEffect(() => {
    if (!isOpen) return;
    setInput('');
    setConfirmInput('');
    setErrorMsg(null);
    setShake(false);
    setShowPw(false);
    setShowConfirm(false);

    const stored = localStorage.getItem(hubKey);
    setPhase(stored ? 'unlock' : 'setup');
  }, [isOpen, hubKey]);

  const triggerError = (msg: string) => {
    setShake(true);
    setErrorMsg(msg);
    setTimeout(() => {
      setInput('');
      setConfirmInput('');
      setShake(false);
    }, 450);
  };

  const handleUnlock = async () => {
    if (!input.trim()) { triggerError('Please enter your Hub Password.'); return; }
    if (input.trim().length < 4) { triggerError('Password must be at least 4 characters.'); return; }

    const stored = localStorage.getItem(hubKey);
    const hash = await hashPin(input.trim());

    if (hash === stored) {
      onSuccess();
    } else {
      triggerError('Incorrect password. Try again.');
    }
  };

  const handleSetup = () => {
    if (!input.trim()) { triggerError('Please enter a password.'); return; }
    if (input.trim().length < 4) { triggerError('Password must be at least 4 characters.'); return; }
    setErrorMsg(null);
    setPhase('confirm');
  };

  const handleConfirm = async () => {
    if (input.trim() !== confirmInput.trim()) {
      triggerError('Passwords do not match. Try again.');
      return;
    }
    const hash = await hashPin(input.trim());
    // ★ Only write to hubKey — NEVER to any room-related key ★
    localStorage.setItem(hubKey, hash);
    onSuccess();
  };

  const handleResetPassword = () => {
    // Only removes the hub entrance password.
    // All rooms (securebox_rooms), chat history, and active room are preserved.
    localStorage.removeItem(hubKey);
    setInput('');
    setConfirmInput('');
    setErrorMsg('Password reset. Enter a new password below.');
    setPhase('setup');
  };

  if (!isOpen) return null;

  const title =
    phase === 'unlock' ? 'Enter Hub Password' :
    phase === 'confirm' ? 'Confirm Password' :
    'Create Hub Password';

  const subtitle =
    phase === 'unlock' ? 'Your personal entrance lock — keep chat hidden' :
    phase === 'confirm' ? 'Re-enter to confirm your new password' :
    'Protects the game disguise on this device only';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0,
      width: '100vw', height: '100vh',
      backgroundColor: Colors.bg.overlay,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 340,
        backgroundColor: Colors.bg.elevated,
        border: `1px solid ${Colors.borderStrong}`,
        borderRadius: 20,
        padding: '28px 22px 22px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.14)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        transform: shake ? 'translateX(-8px)' : 'none',
        transition: 'transform 0.08s ease',
      }}>
        {/* Close — only shown in unlock mode */}
        {phase === 'unlock' && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'none', border: 'none',
              color: Colors.text.placeholder,
              cursor: 'pointer', padding: 4,
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          backgroundColor: Colors.accent.soft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14, color: Colors.accent.primary,
        }}>
          <Lock size={24} />
        </div>

        <h3 style={{
          fontSize: 17, fontWeight: 700,
          color: Colors.text.primary,
          marginBottom: 4, letterSpacing: '-0.3px',
          textAlign: 'center',
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: 12,
          color: errorMsg ? Colors.status.error : Colors.text.secondary,
          marginBottom: 20,
          fontWeight: errorMsg ? 600 : 400,
          textAlign: 'center',
          minHeight: 18,
          padding: '0 8px',
        }}>
          {errorMsg || subtitle}
        </p>

        {/* Password Input */}
        <div style={{ width: '100%', position: 'relative', marginBottom: 12 }}>
          <input
            type={showPw ? 'text' : 'password'}
            value={input}
            onChange={(e) => { setInput(e.target.value); setErrorMsg(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (phase === 'unlock') handleUnlock();
                else if (phase === 'setup') handleSetup();
                else handleConfirm();
              }
            }}
            placeholder={phase === 'confirm' ? 'Re-enter password' : 'Enter password...'}
            autoFocus
            style={{
              width: '100%',
              height: 46,
              borderRadius: 12,
              backgroundColor: Colors.bg.primary,
              border: `1.5px solid ${Colors.borderStrong}`,
              padding: '0 44px 0 16px',
              fontSize: 15,
              color: Colors.text.primary,
              outline: 'none',
              boxSizing: 'border-box',
              letterSpacing: showPw ? 'normal' : '0.2em',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            style={{
              position: 'absolute', right: 12, top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none',
              color: Colors.text.placeholder, cursor: 'pointer', padding: 2,
            }}
          >
            {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        {/* Confirm Input (setup → confirm phase) */}
        {phase === 'confirm' && (
          <div style={{ width: '100%', position: 'relative', marginBottom: 12 }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmInput}
              onChange={(e) => { setConfirmInput(e.target.value); setErrorMsg(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder="Confirm password..."
              autoFocus
              style={{
                width: '100%',
                height: 46,
                borderRadius: 12,
                backgroundColor: Colors.bg.primary,
                border: `1.5px solid ${Colors.borderStrong}`,
                padding: '0 44px 0 16px',
                fontSize: 15,
                color: Colors.text.primary,
                outline: 'none',
                boxSizing: 'border-box',
                letterSpacing: showConfirm ? 'normal' : '0.2em',
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                color: Colors.text.placeholder, cursor: 'pointer', padding: 2,
              }}
            >
              {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          onClick={
            phase === 'unlock' ? handleUnlock :
            phase === 'setup'  ? handleSetup  :
            handleConfirm
          }
          style={{
            width: '100%', height: 46,
            borderRadius: 12,
            backgroundColor: Colors.accent.primary,
            border: 'none',
            color: '#FFF',
            fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            marginBottom: 4,
          }}
        >
          <Check size={16} />
          <span>
            {phase === 'unlock' ? 'Unlock Hub' :
             phase === 'setup'  ? 'Next — Confirm' :
             'Save & Enter Hub'}
          </span>
        </button>

        {/* Back button during confirm phase */}
        {phase === 'confirm' && (
          <button
            onClick={() => { setPhase('setup'); setConfirmInput(''); setErrorMsg(null); }}
            style={{
              marginTop: 8, background: 'none', border: 'none',
              color: Colors.text.secondary, fontSize: 12,
              cursor: 'pointer', padding: '4px 0',
            }}
          >
            ← Back
          </button>
        )}

        {/* Reset Password (only in unlock mode) — NEVER touches rooms */}
        {phase === 'unlock' && (
          <button
            onClick={handleResetPassword}
            style={{
              marginTop: 14, background: 'none', border: 'none',
              color: Colors.text.placeholder, fontSize: 11.5,
              fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 8,
            }}
          >
            <RotateCcw size={11} />
            <span>Forgot Password (rooms are kept safe)</span>
          </button>
        )}
      </div>
    </div>
  );
};
