// client/src/components/ChatHeader.tsx
import React, { useState, useEffect } from 'react';
import { Colors } from '../theme/tokens';
import { Gamepad2, Lock, MoreVertical, ArrowLeft, Clock } from 'lucide-react';

interface ChatHeaderProps {
  partnerName: string;
  isOnline: boolean;
  onHubClick?: () => void;
  onGameClick: () => void;
  onLockClick: () => void;
  onOptionsClick: () => void;
  roomCreatedAt?: number;
  roomExpiresAt?: number;
  onExtendRoom?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  partnerName,
  isOnline,
  onHubClick,
  onGameClick,
  onLockClick,
  onOptionsClick,
  roomCreatedAt,
  roomExpiresAt,
  onExtendRoom,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const effectiveExpiresAt =
    roomExpiresAt || (roomCreatedAt ? roomCreatedAt + 24 * 60 * 60 * 1000 : Date.now() + 24 * 60 * 60 * 1000);
  const diff = Math.max(0, effectiveExpiresAt - now);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const timeRemainingStr = diff <= 0 ? 'Expired' : `${hours}h ${minutes}m left`;
  const isExpiringSoon = hours < 2;

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
    }}>
      {/* Left: Hub Navigation, Avatar & Partner Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 }}>
        {/* Back to Hub Button */}
        {onHubClick && (
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
        )}

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

      {/* Right Actions: Timer, Game Camouflage, Lock, Options */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {/* Countdown Timer Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 7px',
          borderRadius: 9999,
          backgroundColor: isExpiringSoon ? 'rgba(229, 62, 62, 0.08)' : Colors.bg.secondary,
          border: `1px solid ${isExpiringSoon ? 'rgba(229, 62, 62, 0.3)' : Colors.border}`,
          fontSize: 10.5,
          color: isExpiringSoon ? '#E53E3E' : Colors.text.secondary,
          fontWeight: 600,
        }}>
          <Clock size={11} color={isExpiringSoon ? '#E53E3E' : Colors.accent.primary} />
          <span>{timeRemainingStr}</span>
          {onExtendRoom && (
            <button
              onClick={onExtendRoom}
              title="Extend room cycle by +24 hours"
              style={{
                backgroundColor: Colors.accent.soft,
                border: `1px solid ${Colors.accent.light}`,
                color: Colors.accent.primary,
                fontSize: 9.5,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '1px 4px',
                borderRadius: 4,
                marginLeft: 1,
              }}
            >
              +24h
            </button>
          )}
        </div>

        {/* Conceal / Camouflage Game Button */}
        <button
          onClick={onGameClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '5px 7px',
            borderRadius: 8,
            backgroundColor: Colors.accent.soft,
            border: `1px solid ${Colors.accent.light}`,
            color: Colors.accent.primary,
            fontSize: 11.5,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            userSelect: 'none',
            transition: 'all 0.15s ease',
          }}
          title="Conceal chat & jump directly to Brick Smash Game"
        >
          <Gamepad2 size={13} />
          <span>Game</span>
        </button>

        {/* Lock with PIN */}
        <button
          onClick={onLockClick}
          title="Lock room with PIN"
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

        {/* Options */}
        <button
          onClick={onOptionsClick}
          title="Room Options"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: 'transparent',
            border: 'none',
            color: Colors.text.placeholder,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <MoreVertical size={16} />
        </button>
      </div>
    </header>
  );
};
