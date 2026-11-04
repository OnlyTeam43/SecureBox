// client/src/components/FeaturesModal.tsx
import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { BrickWallPeeker } from './BrickWallPeeker';
import {
  X,
  ShieldCheck,
  Gamepad2,
  KeyRound,
  Layers,
  Timer,
  Bomb,
  Camera,
  Radio,
  EyeOff,
  UserX,
  Lock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

interface FeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVault?: () => void;
}

export const FeaturesModal: React.FC<FeaturesModalProps> = ({
  isOpen,
  onClose,
  onOpenVault,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'crypto' | 'disguise' | 'rooms'>('all');

  if (!isOpen) return null;

  const features = [
    {
      category: 'disguise',
      icon: <Gamepad2 size={20} color="#D97757" />,
      title: 'Stealth Arcade Camouflage',
      badge: 'Disguise',
      badgeColor: '#D97757',
      desc: 'SecureBox masquerades as a fully functional retro Brick Smash arcade game with real-time 60-120 FPS physics, animal face balls, falling powerups, high scores, and sound effects. To any bystander or shoulder-surfer, it is nothing more than an innocent game.',
    },
    {
      category: 'crypto',
      icon: <ShieldCheck size={20} color="#2563eb" />,
      title: 'Zero-Knowledge AES-GCM 256-Bit Encryption',
      badge: 'E2EE',
      badgeColor: '#2563eb',
      desc: 'All messages, images, and keys are encrypted directly in your browser using military-grade AES-GCM 256-bit with PBKDF2 (100,000 rounds of SHA-256). Plaintext never touches any server, database, or network packet.',
    },
    {
      category: 'crypto',
      icon: <KeyRound size={20} color="#16a34a" />,
      title: 'Two-Tier Decoupled Keys (Hub vs Room PIN)',
      badge: 'Architecture',
      badgeColor: '#16a34a',
      desc: 'Personal Hub Password locks your personal disguise entrance on this physical device and is never shared. The 4-digit Room Secret PIN is shared exclusively with your partner to derive the cryptographic room session key. Neither key can ever overwrite the other.',
    },
    {
      category: 'rooms',
      icon: <Layers size={20} color="#8b5cf6" />,
      title: 'Strict Room & Chat Isolation (Zero Bleed)',
      badge: 'Sandbox',
      badgeColor: '#8b5cf6',
      desc: 'Every chat room lives in an airtight sandbox with its own isolated localStorage slot (room_chat_<roomId>) and dedicated WebSocket channel. Switching rooms flushes memory state immediately—messages never intersect across different rooms.',
    },
    {
      category: 'rooms',
      icon: <Timer size={20} color="#ea580c" />,
      title: 'Ephemeral 24-Hour Lifespan & +24h Extension',
      badge: 'Ephemeral',
      badgeColor: '#ea580c',
      desc: 'Rooms and encrypted offline buffers automatically self-destruct after 24 hours. If you and your partner wish to continue, either participant can tap the "+24h Extension" tool in the chat header to extend room life.',
    },
    {
      category: 'crypto',
      icon: <Bomb size={20} color="#dc2626" />,
      title: 'Zero-Trace Self-Destruct & Panic Wipe',
      badge: 'Panic Wipe',
      badgeColor: '#dc2626',
      desc: '1-tap "Wipe Room" obliterates local encryption keys, room metadata, and messages permanently from your browser while silently dispatching a cryptographically signed wipe signal to your partner’s device to purge their copy simultaneously.',
    },
    {
      category: 'rooms',
      icon: <Camera size={20} color="#0891b2" />,
      title: 'Encrypted Photo Sharing & Media Viewer',
      badge: 'Photo Privacy',
      badgeColor: '#0891b2',
      desc: 'Photos are compressed via client-side HTML5 Canvas into ultra-compact JPEGs (<90KB) for instant zero-loss transmission over encrypted WebSocket channels. Features fullscreen zoom, pan, and private download.',
    },
    {
      category: 'crypto',
      icon: <Radio size={20} color="#059669" />,
      title: 'Encrypted Offline Relay Queue',
      badge: 'Offline Relay',
      badgeColor: '#059669',
      desc: 'If your partner is offline when a message is sent, the encrypted ciphertext sits temporarily in an ephemeral Supabase buffer. The moment your partner opens the room, packets are fetched, decrypted on device, and immediately wiped from the server.',
    },
    {
      category: 'disguise',
      icon: <EyeOff size={20} color="#475569" />,
      title: 'Stealth Companion Unread Indicator',
      badge: 'Discreet',
      badgeColor: '#475569',
      desc: 'The animal companion avatar on the Brick Smash header doubles as a subtle unread indicator. It gently pulses when new messages arrive without displaying sensitive text or standard system notifications.',
    },
    {
      category: 'disguise',
      icon: <UserX size={20} color="#0d9488" />,
      title: 'Zero Accounts, Zero Cookies, Zero Telemetry',
      badge: 'No Logs',
      badgeColor: '#0d9488',
      desc: 'No registration, no emails, no phone numbers, no tracking cookies, and no analytics. When you close the tab, nothing identifying remains on the web.',
    },
  ];

  const filtered = activeTab === 'all'
    ? features
    : features.filter((f) => f.category === activeTab);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 20, 19, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          backgroundColor: Colors.bg.primary,
          border: `1px solid ${Colors.borderStrong}`,
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${Colors.border}`,
            backgroundColor: Colors.bg.elevated,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: 'rgba(217, 119, 87, 0.1)',
                border: '1.5px solid rgba(217, 119, 87, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <BrickWallPeeker width={38} height={32} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2
                  style={{
                    fontFamily: "'Space Grotesk', -apple-system, sans-serif",
                    fontSize: 18,
                    fontWeight: 700,
                    color: Colors.text.primary,
                    margin: 0,
                    letterSpacing: '-0.3px',
                  }}
                >
                  SecureBox Architecture
                </h2>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    padding: '2px 7px',
                    borderRadius: 9999,
                    backgroundColor: 'rgba(34, 197, 94, 0.12)',
                    color: '#16a34a',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                  }}
                >
                  ZERO KNOWLEDGE
                </span>
              </div>
              <p style={{ fontSize: 13, color: Colors.text.secondary, margin: '2px 0 0 0' }}>
                Complete breakdown of the disguise and cryptographic engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: Colors.bg.secondary,
              border: `1px solid ${Colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: Colors.text.secondary,
              flexShrink: 0,
            }}
            title="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* Filter Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px',
            backgroundColor: Colors.bg.elevated,
            borderBottom: `1px solid ${Colors.border}`,
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'all', label: 'All Capabilities' },
            { id: 'crypto', label: 'E2EE & Crypto' },
            { id: 'disguise', label: 'Arcade Camouflage' },
            { id: 'rooms', label: 'Isolated Ephemeral Rooms' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '6px 13px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                border: activeTab === tab.id
                  ? `1px solid ${Colors.accent.primary}`
                  : `1px solid ${Colors.border}`,
                backgroundColor: activeTab === tab.id
                  ? Colors.accent.primary
                  : Colors.bg.secondary,
                color: activeTab === tab.id
                  ? Colors.text.inverse
                  : Colors.text.secondary,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Feature Cards List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {filtered.map((item, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: Colors.bg.elevated,
                border: `1px solid ${Colors.border}`,
                borderRadius: 14,
                padding: '16px 18px',
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                transition: 'transform 0.12s ease, border-color 0.12s ease',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: Colors.bg.secondary,
                  border: `1px solid ${Colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {item.icon}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: Colors.text.primary,
                      margin: 0,
                    }}
                  >
                    {item.title}
                  </h3>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      backgroundColor: `${item.badgeColor}15`,
                      color: item.badgeColor,
                      border: `1px solid ${item.badgeColor}35`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.badge}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: Colors.text.secondary,
                    margin: 0,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${Colors.border}`,
            backgroundColor: Colors.bg.elevated,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: Colors.text.secondary }}>
            <CheckCircle2 size={14} color="#16a34a" />
            <span>Zero Server Logs • Client-side PBKDF2</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onOpenVault && (
              <button
                onClick={() => {
                  onClose();
                  onOpenVault();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 10,
                  backgroundColor: Colors.accent.primary,
                  border: 'none',
                  color: Colors.text.inverse,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Lock size={14} />
                <span>Open Secret Vault</span>
                <ChevronRight size={14} />
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                backgroundColor: Colors.bg.secondary,
                border: `1px solid ${Colors.border}`,
                color: Colors.text.primary,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
