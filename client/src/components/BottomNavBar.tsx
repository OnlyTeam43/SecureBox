// client/src/components/BottomNavBar.tsx
import React from 'react';
import { MessageSquare, UploadCloud, User } from 'lucide-react';

export type BottomNavTab = 'chat' | 'quickdrop' | 'user';

interface BottomNavBarProps {
  activeTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
  maxWidth?: number | string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  maxWidth = 520,
}) => {
  return (
    <nav
      aria-label="Bottom navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth,
        margin: '0 auto',
        height: 'calc(58px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E7E5E4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 999,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.04)',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* 1st Tab: Chat */}
      <button
        onClick={() => onTabChange('chat')}
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          transition: 'transform 0.1s ease',
        }}
        title="Chat & Encrypted Rooms"
      >
        <MessageSquare
          size={22}
          color={activeTab === 'chat' ? '#D97757' : '#78716C'}
          strokeWidth={activeTab === 'chat' ? 2.4 : 1.8}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: activeTab === 'chat' ? 700 : 500,
            color: activeTab === 'chat' ? '#D97757' : '#78716C',
            letterSpacing: '0.2px',
          }}
        >
          Chat
        </span>
      </button>

      {/* 2nd Tab: QuickDrop */}
      <button
        onClick={() => onTabChange('quickdrop')}
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          transition: 'transform 0.1s ease',
        }}
        title="QuickDrop - Zero-Login Media, Link & Text Shuttle"
      >
        <UploadCloud
          size={22}
          color={activeTab === 'quickdrop' ? '#D97757' : '#78716C'}
          strokeWidth={activeTab === 'quickdrop' ? 2.4 : 1.8}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: activeTab === 'quickdrop' ? 700 : 500,
            color: activeTab === 'quickdrop' ? '#D97757' : '#78716C',
            letterSpacing: '0.2px',
          }}
        >
          QuickDrop
        </span>
      </button>

      {/* 3rd Tab: User */}
      <button
        onClick={() => onTabChange('user')}
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          transition: 'transform 0.1s ease',
        }}
        title="User Profile & Settings"
      >
        <User
          size={22}
          color={activeTab === 'user' ? '#D97757' : '#78716C'}
          strokeWidth={activeTab === 'user' ? 2.4 : 1.8}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: activeTab === 'user' ? 700 : 500,
            color: activeTab === 'user' ? '#D97757' : '#78716C',
            letterSpacing: '0.2px',
          }}
        >
          User
        </span>
      </button>
    </nav>
  );
};
