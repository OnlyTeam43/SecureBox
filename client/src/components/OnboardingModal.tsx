// client/src/components/OnboardingModal.tsx
// First-time onboarding: Ask user for their Name (@handle) and Hub Password.
// Always remembers the handle and password locally on this device.

import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { hashPin } from '../services/crypto';
import { ShieldCheck, Eye, EyeOff, ArrowRight, UserCheck } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (handle: string, passwordHash: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clean to alphanumeric + underscore/hyphen, strip leading @, max 20 chars
    const cleaned = e.target.value.replace(/^@+/, '').replace(/[^a-zA-Z0-9_\-\s]/g, '').slice(0, 20);
    setHandle(cleaned);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanHandle = handle.trim();
    if (!cleanHandle || cleanHandle.length < 2) {
      setError('Please choose a handle with at least 2 characters.');
      return;
    }

    if (!password || password.length < 3) {
      setError('Hub password must be at least 3 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const hashed = await hashPin(password);
      localStorage.setItem('securebox_user_handle', cleanHandle);
      localStorage.setItem('securebox_hub_hash', hashed);
      localStorage.setItem('securebox_screen_mode', 'hub');
      onComplete(cleanHandle, hashed);
    } catch (err) {
      console.error('Onboarding hashing error:', err);
      setError('Could not secure password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        backgroundColor: 'rgba(20, 21, 24, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: Colors.bg.elevated,
          border: `1px solid ${Colors.borderStrong}`,
          borderRadius: 20,
          padding: '28px 24px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.22)',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header Icon & Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: Colors.accent.soft,
              color: Colors.accent.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: Colors.text.primary,
                letterSpacing: '-0.3px',
                margin: 0,
              }}
            >
              Welcome to SecureBox
            </h2>
            <span style={{ fontSize: 12, color: Colors.text.secondary }}>
              Anonymous profile &amp; device vault setup
            </span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: Colors.text.secondary, lineHeight: 1.5, marginBottom: 18 }}>
          Choose your display handle and a personal Hub Password. These are stored locally on your device only.
        </p>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#DC2626',
              fontSize: 12.5,
              fontWeight: 500,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Field 1: Handle / Name */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 700,
                color: Colors.text.secondary,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Your Display Handle
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 14,
                  fontSize: 15,
                  fontWeight: 700,
                  color: Colors.accent.primary,
                  userSelect: 'none',
                }}
              >
                @
              </span>
              <input
                type="text"
                value={handle}
                onChange={handleNameChange}
                placeholder="Alex"
                maxLength={20}
                required
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: Colors.bg.primary,
                  border: `1px solid ${Colors.borderStrong}`,
                  padding: '0 14px 0 32px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: Colors.text.primary,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {handle.trim() && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11.5,
                  color: Colors.accent.primary,
                  fontWeight: 600,
                  marginTop: 5,
                }}
              >
                <UserCheck size={12} />
                <span>You will appear as @{handle.trim()}</span>
              </div>
            )}
          </div>

          {/* Field 2: Hub Password */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 700,
                color: Colors.text.secondary,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Hub Password (Vault Lock)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter password..."
                required
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: Colors.bg.primary,
                  border: `1px solid ${Colors.borderStrong}`,
                  padding: '0 40px 0 14px',
                  fontSize: 14,
                  color: Colors.text.primary,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: Colors.text.secondary,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Field 3: Confirm Hub Password */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11.5,
                fontWeight: 700,
                color: Colors.text.secondary,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Confirm Hub Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Re-enter password..."
                required
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: Colors.bg.primary,
                  border: `1px solid ${Colors.borderStrong}`,
                  padding: '0 40px 0 14px',
                  fontSize: 14,
                  color: Colors.text.primary,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: Colors.text.secondary,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: 6,
              width: '100%',
              height: 46,
              borderRadius: 12,
              backgroundColor: Colors.accent.primary,
              color: '#FFFFFF',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: isSubmitting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(217, 119, 87, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{isSubmitting ? 'Saving Profile...' : 'Save & Continue'}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
