// client/src/components/PinModal.tsx
import React, { useState, useEffect } from 'react';
import { Colors } from '../theme/tokens';
import { hashPin } from '../services/crypto';
import { Lock, X, Check, RotateCcw } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasExistingPin, setHasExistingPin] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setShake(false);
      setErrorMsg(null);
      const stored = localStorage.getItem('securebox_pin_hash');
      setHasExistingPin(Boolean(stored));
    }
  }, [isOpen]);

  // Keyboard typing
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        handleVerifyPin(pin);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, pin]);

  const handleDigit = (d: string) => {
    if (pin.length >= 6) return;
    setErrorMsg(null);
    const nextPin = pin + d;
    setPin(nextPin);

    // If 4 digits reached, automatically attempt verification
    if (nextPin.length === 4) {
      handleVerifyPin(nextPin, false);
    } else if (nextPin.length === 6) {
      handleVerifyPin(nextPin, true);
    }
  };

  const handleBackspace = () => {
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleVerifyPin = async (candidatePin: string, isFinal = false) => {
    if (candidatePin.length < 4) {
      if (isFinal) {
        triggerError('PIN must be at least 4 digits');
      }
      return;
    }

    try {
      const storedHash = localStorage.getItem('securebox_pin_hash');
      const inputHash = await hashPin(candidatePin);

      // If no PIN set yet, any 4-digit PIN becomes the master PIN!
      if (!storedHash) {
        localStorage.setItem('securebox_pin_hash', inputHash);
        onSuccess();
        return;
      }

      if (inputHash === storedHash) {
        setErrorMsg(null);
        onSuccess();
      } else {
        // If candidate is 6 digits OR user pressed OK/Enter OR candidate didn't match
        if (candidatePin.length >= 4) {
          triggerError('Incorrect PIN');
        }
      }
    } catch (e) {
      console.error('PIN verification error:', e);
    }
  };

  const triggerError = (msg: string) => {
    setShake(true);
    setErrorMsg(msg);
    setTimeout(() => {
      setPin('');
      setShake(false);
    }, 450);
  };

  const handleResetPin = () => {
    if (confirm('Reset your secret PIN? This will let you set a new PIN.')) {
      localStorage.removeItem('securebox_pin_hash');
      setHasExistingPin(false);
      setPin('');
      setErrorMsg(null);
      alert('PIN has been reset. Enter any 4-digit PIN to set your new one.');
    }
  };

  if (!isOpen) return null;

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
        maxWidth: 320,
        backgroundColor: Colors.bg.elevated,
        border: `1px solid ${Colors.borderStrong}`,
        borderRadius: 20,
        padding: '24px 20px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        transform: shake ? 'translateX(-8px)' : 'none',
        transition: 'transform 0.08s ease',
      }}>
        {/* Close Button */}
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

        {/* Header Icon */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          backgroundColor: Colors.accent.soft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          color: Colors.accent.primary,
        }}>
          <Lock size={22} />
        </div>

        <h3 style={{
          fontSize: 17,
          fontWeight: 600,
          color: Colors.text.primary,
          marginBottom: 4,
          letterSpacing: '-0.3px',
        }}>
          {hasExistingPin ? 'Security PIN' : 'Set Your PIN'}
        </h3>
        <p style={{
          fontSize: 12,
          color: errorMsg ? Colors.status.error : Colors.text.secondary,
          marginBottom: 18,
          fontWeight: errorMsg ? 600 : 400,
        }}>
          {errorMsg || (hasExistingPin ? 'Enter your 4-digit PIN' : 'Enter 4 digits to set your PIN')}
        </p>

        {/* PIN Dots (4 dots) */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = idx < pin.length;
            return (
              <div
                key={idx}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: `2px solid ${isFilled ? Colors.accent.primary : Colors.borderStrong}`,
                  backgroundColor: isFilled ? Colors.accent.primary : 'transparent',
                  transform: isFilled ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            );
          })}
        </div>

        {/* Keypad */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          width: '100%',
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              style={{
                height: 52,
                borderRadius: 12,
                backgroundColor: Colors.bg.secondary,
                border: `1px solid ${Colors.border}`,
                color: Colors.text.primary,
                fontSize: 20,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {digit}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            style={{
              height: 52,
              borderRadius: 12,
              backgroundColor: Colors.bg.secondary,
              border: `1px solid ${Colors.border}`,
              color: Colors.text.secondary,
              fontSize: 16,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            ⌫
          </button>
          <button
            onClick={() => handleDigit('0')}
            style={{
              height: 52,
              borderRadius: 12,
              backgroundColor: Colors.bg.secondary,
              border: `1px solid ${Colors.border}`,
              color: Colors.text.primary,
              fontSize: 20,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            0
          </button>
          <button
            onClick={() => handleVerifyPin(pin, true)}
            style={{
              height: 52,
              borderRadius: 12,
              backgroundColor: Colors.accent.primary,
              border: 'none',
              color: '#FFF',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Unlock"
          >
            <Check size={18} />
          </button>
        </div>

        {/* Reset PIN link */}
        {hasExistingPin && (
          <button
            onClick={handleResetPin}
            style={{
              marginTop: 16,
              background: 'none',
              border: 'none',
              color: Colors.text.placeholder,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <RotateCcw size={12} />
            <span>Forgot or Reset PIN</span>
          </button>
        )}
      </div>
    </div>
  );
};
