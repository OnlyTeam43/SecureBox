// client/src/components/ChatHeader.tsx
import React, { useState, useEffect } from 'react';
import { Colors } from '../theme/tokens';
import { Gamepad2, Lock, MoreVertical, ArrowLeft, Clock } from 'lucide-react';

interface ChatHeaderProps {
  partnerName: string;
  isOnline: boolean;
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
  onGameClick,
  onLockClick,
  onOptionsClick,
  roomCreatedAt,
  roomExpiresAt,
  onExtendRoom,
}) => {
  const initial = partnerName ? partnerName.charAt(0).toUpperCase() : 'P';

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000); // refresh countdown every 15s
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
      height: 56,
      minHeight: 56,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      backgroundColor: Colors.bg.elevated,
      borderBottom: `1px solid ${Colors.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      zIndex: 50,
      boxSizing: 'border-box',
    }}>
      {/* Left: Prominent Back / Jump to Game Navigation Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <button
          onClick={onGameClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 12px',
            borderRadius: 9999,
            backgroundColor: Colors.bg.secondary,
            border: `1px solid ${Colors.borderStrong}`,
            color: Colors.accent.primary,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            userSelect: 'none',
          }}
          title="Jump directly to Brick Smash Game"
        >
          <ArrowLeft size={16} />
          <Gamepad2 size={16} />
          <span>Game</span>
        </button>

        {/* Partner Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: Colors.accent.light,
            color: Colors.accent.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <span style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: Colors.text.primary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {partnerName || 'Waiting...'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: isOnline ? Colors.status.online : Colors.status.offline,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 10.5, color: Colors.text.placeholder }}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle/Right: Room 24h Countdown Timer & +24h Extension Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 8px',
          borderRadius: 9999,
          backgroundColor: isExpiringSoon ? 'rgba(229, 62, 62, 0.08)' : Colors.bg.secondary,
          border: `1px solid ${isExpiringSoon ? 'rgba(229, 62, 62, 0.3)' : Colors.border}`,
          fontSize: 11,
          color: isExpiringSoon ? '#E53E3E' : Colors.text.secondary,
          fontWeight: 600,
        }}>
          <Clock size={12} color={isExpiringSoon ? '#E53E3E' : Colors.accent.primary} />
          <span>{timeRemainingStr}</span>
          {onExtendRoom && (
            <button
              onClick={onExtendRoom}
              title="Extend room cycle by +24 hours"
              style={{
                backgroundColor: Colors.accent.soft,
                border: `1px solid ${Colors.accent.light}`,
                color: Colors.accent.primary,
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '2px 5px',
                borderRadius: 5,
                marginLeft: 1,
              }}
            >
              +24h
            </button>
          )}
        </div>

        {/* Lock with PIN */}
        <button
          onClick={onLockClick}
          title="Lock room with PIN"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: Colors.accent.soft,
            border: `1px solid ${Colors.border}`,
            color: Colors.accent.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Lock size={15} />
        </button>

        {/* Options */}
        <button
          onClick={onOptionsClick}
          title="Room Options"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: 'transparent',
            border: 'none',
            color: Colors.text.placeholder,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <MoreVertical size={18} />
        </button>
      </div>
    </header>
  );
};
