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
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  hubKey,
  title: customTitle,
  subtitle: customSubtitle,
  onClose,
  onSuccess,
}) => {
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
    if (input.trim().length < 3) { triggerError('Password must be at least 3 characters.'); return; }

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
    if (input.trim().length < 3) { triggerError('Password must be at least 3 characters.'); return; }
    setErrorMsg(null);
    setPhase('confirm');
  };

  const handleConfirm = async () => {
    if (input.trim() !== confirmInput.trim()) {
      triggerError('Passwords do not match. Try again.');
      return;
    }
    const hash = await hashPin(input.trim());
    localStorage.setItem(hubKey, hash);
    onSuccess();
  };

  const handleResetPassword = () => {
    localStorage.removeItem(hubKey);
    setInput('');
    setConfirmInput('');
    setErrorMsg('Password reset. Enter a new password below.');
    setPhase('setup');
  };

  if (!isOpen) return null;

  const title =
    customTitle ||
    (phase === 'unlock' ? 'Enter Hub Password' :
    phase === 'confirm' ? 'Confirm Password' :
    'Create Hub Password');

  const subtitle =
    customSubtitle ||
    (phase === 'unlock' ? 'Your personal entrance lock — keep chat hidden' :
    phase === 'confirm' ? 'Re-enter to confirm your new password' :
    'Protects the game disguise on this device only');

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
        }}>
          {errorMsg || subtitle}
        </p>

        {/* UNLOCK PHASE */}
        {phase === 'unlock' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleUnlock(); }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={input}
                onChange={(e) => { setInput(e.target.value); setErrorMsg(null); }}
                placeholder="Enter password..."
                autoFocus
                style={{
                  width: '100%', height: 46, borderRadius: 12,
                  backgroundColor: Colors.bg.primary,
                  border: `1.5px solid ${errorMsg ? Colors.status.error : Colors.borderStrong}`,
                  padding: '0 44px 0 14px', fontSize: 16,
                  color: Colors.text.primary, outline: 'none',
                  boxSizing: 'border-box',
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
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              style={{
                width: '100%', height: 46, borderRadius: 12,
                backgroundColor: Colors.accent.primary,
                border: 'none', color: Colors.text.inverse,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Unlock Hub
            </button>

            {/* Reset option */}
            <button
              type="button"
              onClick={handleResetPassword}
              style={{
                background: 'none', border: 'none',
                color: Colors.text.placeholder, fontSize: 11,
                cursor: 'pointer', marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <RotateCcw size={11} />
              <span>Forgot password? Reset</span>
            </button>
          </form>
        )}

        {/* SETUP PHASE */}
        {phase === 'setup' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSetup(); }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={input}
                onChange={(e) => { setInput(e.target.value); setErrorMsg(null); }}
                placeholder="Create password..."
                autoFocus
                style={{
                  width: '100%', height: 46, borderRadius: 12,
                  backgroundColor: Colors.bg.primary,
                  border: `1.5px solid ${errorMsg ? Colors.status.error : Colors.borderStrong}`,
                  padding: '0 44px 0 14px', fontSize: 16,
                  color: Colors.text.primary, outline: 'none',
                  boxSizing: 'border-box',
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
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              style={{
                width: '100%', height: 46, borderRadius: 12,
                backgroundColor: Colors.accent.primary,
                border: 'none', color: Colors.text.inverse,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Check size={16} />
              <span>Next — Confirm</span>
            </button>
          </form>
        )}

        {/* CONFIRM PHASE */}
        {phase === 'confirm' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleConfirm(); }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmInput}
                onChange={(e) => { setConfirmInput(e.target.value); setErrorMsg(null); }}
                placeholder="Re-type password..."
                autoFocus
                style={{
                  width: '100%', height: 46, borderRadius: 12,
                  backgroundColor: Colors.bg.primary,
                  border: `1.5px solid ${errorMsg ? Colors.status.error : Colors.borderStrong}`,
                  padding: '0 44px 0 14px', fontSize: 16,
                  color: Colors.text.primary, outline: 'none',
                  boxSizing: 'border-box',
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
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              style={{
                width: '100%', height: 46, borderRadius: 12,
                backgroundColor: Colors.accent.primary,
                border: 'none', color: Colors.text.inverse,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Check size={16} />
              <span>Save &amp; Unlock</span>
            </button>

            <button
              type="button"
              onClick={() => { setPhase('setup'); setConfirmInput(''); setErrorMsg(null); }}
              style={{
                background: 'none', border: 'none',
                color: Colors.text.placeholder, fontSize: 12, cursor: 'pointer',
              }}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
