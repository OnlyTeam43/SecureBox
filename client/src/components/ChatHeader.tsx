// client/src/components/ChatHeader.tsx
import React from 'react';
import { Colors } from '../theme/tokens';
import { Gamepad2, Lock, MoreVertical } from 'lucide-react';

interface ChatHeaderProps {
  partnerName: string;
  isOnline: boolean;
  onGameClick: () => void;
  onLockClick: () => void;
  onOptionsClick: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  partnerName,
  isOnline,
  onGameClick,
  onLockClick,
  onOptionsClick,
}) => {
  const initial = partnerName ? partnerName.charAt(0).toUpperCase() : 'P';

  return (
    <div style={{
      height: 56,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      backgroundColor: Colors.bg.elevated,
      borderBottom: `1px solid ${Colors.border}`,
      zIndex: 20,
    }}>
      {/* Partner Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: Colors.accent.light,
          color: Colors.accent.secondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: 15,
        }}>
          {initial}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: Colors.text.primary }}>
            {partnerName || 'Waiting for partner...'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isOnline ? Colors.status.online : Colors.status.offline,
            }} />
            <span style={{ fontSize: 11, color: Colors.text.placeholder }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions: 🎮 Game & 🔒 Lock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Game Icon - Conceal Chat */}
        <button
          onClick={onGameClick}
          title="Conceal chat & play Brick Smash"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: Colors.bg.secondary,
            border: `1px solid ${Colors.border}`,
            color: Colors.text.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Gamepad2 size={17} color={Colors.accent.primary} />
        </button>

        {/* Lock Icon - Lock with PIN */}
        <button
          onClick={onLockClick}
          title="Lock room with PIN"
          style={{
            width: 36,
            height: 36,
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
            width: 36,
            height: 36,
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
    </div>
  );
};
