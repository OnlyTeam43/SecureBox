// client/src/components/UserProfileView.tsx
import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import {
  User,
  ShieldCheck,
  Lock,
  Download,
  Smartphone,
  Trash2,
  Gamepad2,
  Check,
  Edit2,
  KeyRound,
  ChevronRight,
  Info,
} from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface UserProfileViewProps {
  onPlayGame: () => void;
  onOpenPinModal: () => void;
  savedRoomsCount: number;
  onClearAllData?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  onPlayGame,
  onOpenPinModal,
  savedRoomsCount,
  onClearAllData,
}) => {
  const [handle, setHandle] = useState(() => {
    return localStorage.getItem('securebox_user_handle') || 'Anonymous';
  });
  const [isEditingHandle, setIsEditingHandle] = useState(false);
  const [handleInput, setHandleInput] = useState(handle);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);
  const { canInstall, installApp } = usePWAInstall();

  const handleSaveHandle = () => {
    const clean = handleInput.trim().replace(/^@+/, '').slice(0, 20);
    if (clean) {
      setHandle(clean);
      localStorage.setItem('securebox_user_handle', clean);
    }
    setIsEditingHandle(false);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.origin).then(() => {
      setCopiedAppUrl(true);
      setTimeout(() => setCopiedAppUrl(false), 2000);
    });
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        backgroundColor: Colors.bg.primary,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'calc(2px + env(safe-area-inset-top, 0px)) 12px 76px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '2px 0',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: Colors.text.primary,
                letterSpacing: '-0.3px',
                margin: 0,
              }}
            >
              User Profile &amp; Settings
            </h1>
            <span style={{ fontSize: 11, color: Colors.text.secondary }}>
              Local device vault configuration
            </span>
          </div>

          <button
            onClick={onPlayGame}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 11px',
              borderRadius: 9999,
              backgroundColor: '#F5EBE6',
              border: '1px solid #F0CFC2',
              color: Colors.accent.primary,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Lock Vault & Return to Game Disguise"
          >
            <Gamepad2 size={13} color={Colors.accent.primary} />
            <span>Lock to Game</span>
          </button>
        </div>

        {/* User Card */}
        <div
          style={{
            backgroundColor: Colors.bg.elevated,
            border: `1px solid ${Colors.border}`,
            borderRadius: 16,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: '#F5EBE6',
              border: '2px solid #F0CFC2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <User size={26} color={Colors.accent.primary} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditingHandle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="text"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value.slice(0, 20))}
                  placeholder="Your handle"
                  style={{
                    flex: 1,
                    height: 34,
                    borderRadius: 8,
                    border: `1px solid ${Colors.accent.primary}`,
                    padding: '0 10px',
                    fontSize: 13,
                    fontWeight: 600,
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveHandle}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    backgroundColor: Colors.accent.primary,
                    border: 'none',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: Colors.text.primary }}>
                    @{handle}
                  </div>
                  <div style={{ fontSize: 11, color: Colors.text.secondary }}>
                    Display Handle in Encrypted Rooms
                  </div>
                </div>
                <button
                  onClick={() => {
                    setHandleInput(handle);
                    setIsEditingHandle(true);
                  }}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    backgroundColor: Colors.bg.secondary,
                    border: `1px solid ${Colors.border}`,
                    color: Colors.text.secondary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                  }}
                >
                  <Edit2 size={12} />
                  <span>Edit</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Security Settings Section */}
        <div
          style={{
            backgroundColor: Colors.bg.elevated,
            border: `1px solid ${Colors.border}`,
            borderRadius: 16,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: Colors.text.secondary, textTransform: 'uppercase' }}>
            Vault Security &amp; PIN
          </div>

          <div
            onClick={onOpenPinModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: 10,
              backgroundColor: Colors.bg.secondary,
              border: `1px solid ${Colors.border}`,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <KeyRound size={17} color={Colors.accent.primary} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: Colors.text.primary }}>
                  Change Hub Password
                </div>
                <div style={{ fontSize: 10.5, color: Colors.text.secondary }}>
                  Lock &amp; protect room inventory behind PIN
                </div>
              </div>
            </div>
            <ChevronRight size={15} color="#A8A29E" />
          </div>

          <div
            onClick={onPlayGame}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: 10,
              backgroundColor: Colors.bg.secondary,
              border: `1px solid ${Colors.border}`,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={17} color="#57534E" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: Colors.text.primary }}>
                  Lock Vault Immediately
                </div>
                <div style={{ fontSize: 10.5, color: Colors.text.secondary }}>
                  Switch to Brick Smash arcade game disguise
                </div>
              </div>
            </div>
            <ChevronRight size={15} color="#A8A29E" />
          </div>
        </div>

        {/* App Installation & Downloads */}
        <div
          style={{
            backgroundColor: Colors.bg.elevated,
            border: `1px solid ${Colors.border}`,
            borderRadius: 16,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: Colors.text.secondary, textTransform: 'uppercase' }}>
            App Installation
          </div>

          <a
            href="/securebox.apk"
            download="SecureBox.apk"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: 10,
              textDecoration: 'none',
              backgroundColor: 'rgba(217, 107, 67, 0.08)',
              border: '1px solid rgba(217, 107, 67, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Download size={17} color={Colors.accent.primary} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: Colors.accent.primary }}>
                  Download Android APK
                </div>
                <div style={{ fontSize: 10.5, color: '#78716C' }}>
                  Standalone native WebView app (2.9 MB)
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: Colors.accent.primary,
                backgroundColor: '#FFFFFF',
                padding: '2px 7px',
                borderRadius: 6,
              }}
            >
              APK
            </span>
          </a>

          {canInstall && (
            <div
              onClick={installApp}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 10,
                cursor: 'pointer',
                backgroundColor: '#E8F5E9',
                border: '1px solid #A5D6A7',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Smartphone size={17} color="#2E7D32" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32' }}>
                    Install to Home Screen
                  </div>
                  <div style={{ fontSize: 10.5, color: '#388E3C' }}>
                    Progressive Web App (PWA)
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#2E7D32' }}>
                INSTALL
              </span>
            </div>
          )}
        </div>

        {/* Data & Privacy Metrics */}
        <div
          style={{
            backgroundColor: Colors.bg.elevated,
            border: `1px solid ${Colors.border}`,
            borderRadius: 16,
            padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: Colors.text.secondary, textTransform: 'uppercase' }}>
            Vault Metrics &amp; Privacy
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: Colors.text.secondary }}>
            <span>Active Saved Rooms</span>
            <span style={{ fontWeight: 600, color: Colors.text.primary }}>{savedRoomsCount} Rooms</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: Colors.text.secondary }}>
            <span>Cryptographic Mode</span>
            <span style={{ fontWeight: 600, color: Colors.accent.primary }}>AES-256-GCM Client Side</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: Colors.text.secondary }}>
            <span>Server Retention</span>
            <span style={{ fontWeight: 600, color: '#2E7D32' }}>Zero Server Logs</span>
          </div>

          {onClearAllData && (
            <button
              onClick={() => {
                if (confirm('Clear all local room history and cached keys from this device?')) {
                  onClearAllData();
                }
              }}
              style={{
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 10,
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Trash2 size={14} />
              <span>Reset Local Vault Data</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
