// client/src/components/ChatHeader.tsx
import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { Gamepad2, Lock, MoreVertical, ArrowLeft, Home, Trash2 } from 'lucide-react';

interface ChatHeaderProps {
  partnerName: string;
  isOnline: boolean;
  onHubClick: () => void;
  onGameClick: () => void;
  onLockClick: () => void;
  onWipeClick: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  partnerName,
  isOnline,
  onHubClick,
  onGameClick,
  onLockClick,
  onWipeClick,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header style={{
      flexShrink: 0,
      height: 58,
      minHeight: 58,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      backgroundColor: Colors.bg.elevated,
      borderBottom: `1px solid ${Colors.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      zIndex: 50,
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* Left: Hub Navigation, Avatar & Partner Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 }}>
        {/* Back to Hub Button */}
        <button
          onClick={onHubClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 9px',
            borderRadius: 8,
            backgroundColor: Colors.bg.secondary,
            border: `1px solid ${Colors.borderStrong}`,
            color: Colors.text.primary,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            userSelect: 'none',
            transition: 'all 0.15s ease',
          }}
          title="Return to SecureBox Hub"
        >
          <ArrowLeft size={14} />
          <span>Hub</span>
        </button>

        {/* Animal Character Avatar from Assets */}
        <div style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          border: `1.5px solid ${Colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <img
            src="/characters/panda-idle.png"
            alt="Animal Avatar"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              objectFit: 'contain',
            }}
          />
        </div>

        {/* Partner Name & Real-time Connection Status */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
          <span style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: Colors.text.primary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
          }}>
            {partnerName || 'Waiting for partner...'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isOnline ? Colors.status.online : '#E0A82E',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 10.5,
              fontWeight: isOnline ? 600 : 500,
              color: isOnline ? Colors.status.online : '#B07E15',
              whiteSpace: 'nowrap',
            }}>
              {isOnline ? 'Connected' : 'Waiting...'}
            </span>
          </div>
        </div>
      </div>

      {/* Right Actions: Game Camouflage, Lock, 3-Dots Options */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, position: 'relative' }}>
        {/* Conceal / Camouflage Game Button */}
        <button
          onClick={onGameClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 9px',
            borderRadius: 8,
            backgroundColor: Colors.accent.soft,
            border: `1px solid ${Colors.accent.light}`,
            color: Colors.accent.primary,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            userSelect: 'none',
            transition: 'all 0.15s ease',
          }}
          title="Conceal chat & jump directly to Brick Smash Game"
        >
          <Gamepad2 size={14} />
          <span>Game</span>
        </button>

        {/* Lock with PIN */}
        <button
          onClick={onLockClick}
          title="Lock to Disguise with PIN"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: Colors.accent.soft,
            border: `1px solid ${Colors.border}`,
            color: Colors.accent.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Lock size={14} />
        </button>

        {/* 3-Dots Menu Trigger */}
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          title="Room Options"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: isMenuOpen ? Colors.bg.secondary : 'transparent',
            border: isMenuOpen ? `1px solid ${Colors.borderStrong}` : 'none',
            color: isMenuOpen ? Colors.text.primary : Colors.text.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <MoreVertical size={16} />
        </button>

        {/* 3-Dots Options Dropdown Popup Menu */}
        {isMenuOpen && (
          <>
            <div
              onClick={() => setIsMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 90,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 42,
                right: 0,
                width: 220,
                backgroundColor: Colors.bg.elevated,
                border: `1px solid ${Colors.borderStrong}`,
                borderRadius: 14,
                padding: '6px',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.18)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onHubClick();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: Colors.text.primary,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = Colors.bg.secondary)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Home size={15} color={Colors.accent.primary} />
                <span>Return to Hub</span>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onGameClick();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: Colors.text.primary,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = Colors.bg.secondary)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Gamepad2 size={15} color={Colors.accent.primary} />
                <span>Play Retro Game</span>
              </button>

              <div style={{ height: 1, backgroundColor: Colors.border, margin: '2px 4px' }} />

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onWipeClick();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#DC2626',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.06)')}
              >
                <Trash2 size={15} color="#DC2626" />
                <span>Wipe &amp; Self-Destruct</span>
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
