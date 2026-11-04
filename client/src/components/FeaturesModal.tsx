// client/src/components/FeaturesModal.tsx
// Styled after https://www.kanelijo.com/securebox
// Modern editorial design: Serif headings, warm ivory surfaces (#FAF9F6),
// dark card accents (#141518), and complete feature breakdown.

import React from 'react';
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
  ExternalLink,
  ChevronRight,
  Download,
  Lock,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { BrickWallPeeker } from './BrickWallPeeker';

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
  if (!isOpen) return null;

  const animals = [
    { name: 'Panda', trait: 'Zen, balanced, calm.', img: '/characters/panda-idle.png', bg: '#FAF0EB' },
    { name: 'Cat', trait: 'Nimble, independent, sharp.', img: '/characters/cat-idle.png', bg: '#FEF6E9' },
    { name: 'Puppy', trait: 'Energetic, loyal, warm.', img: '/characters/puppy-idle.png', bg: '#FDF2EE' },
    { name: 'Fox', trait: 'Clever, stealthy, swift.', img: '/characters/cat-talking.png', bg: '#FBF3EB' },
    { name: 'Bear', trait: 'Strong, protective, grounded.', img: '/characters/panda-call.png', bg: '#F5F3EC' },
    { name: 'Bunny', trait: 'Gentle, alert, quick.', img: '/characters/puppy-typing.png', bg: '#FDF4F5' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(17, 17, 17, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '92vh',
          backgroundColor: '#FAF9F6',
          borderRadius: 28,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(229, 231, 235, 0.9)',
          animation: 'modalSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(231, 229, 228, 0.8)',
            backgroundColor: 'rgba(250, 249, 246, 0.95)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrickWallPeeker width={34} height={28} />
            <div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#E05A38',
                  display: 'block',
                }}
              >
                SECUREBOX • KANELIJO &amp; TEAM43
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1A1A1A',
                  letterSpacing: '-0.2px',
                }}
              >
                Feature Blueprint &amp; Architecture
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href="https://www.kanelijo.com/securebox"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 9999,
                backgroundColor: '#FFFFFF',
                border: '1px solid #E7E5E4',
                color: '#1C1917',
                fontSize: 11.5,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <span>kanelijo.com</span>
              <ExternalLink size={12} color="#E05A38" />
            </a>

            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E7E5E4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#57534E',
              }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 20px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            color: '#1A1A1A',
          }}
        >
          {/* Hero Section (kanelijo.com style) */}
          <div style={{ textAlign: 'left' }}>
            <div
              style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#E05A38',
                marginBottom: 8,
              }}
            >
              SECUREBOX FOR ANDROID &amp; WEB
            </div>

            <h1
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 'clamp(26px, 5vw, 36px)',
                lineHeight: 1.15,
                fontWeight: 400,
                color: '#111111',
                margin: '0 0 12px 0',
                letterSpacing: '-0.5px',
              }}
            >
              Looks like a game.<br />
              Opens like a vault.
            </h1>

            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.55,
                color: '#44403C',
                margin: '0 0 20px 0',
                maxWidth: 520,
              }}
            >
              SecureBox is a zero-knowledge private chat and media vault hidden inside a
              fully playable brick-breaker arcade game. Hold the animal icon or tap the PIN
              and your private encrypted room opens instantly.
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {onOpenVault && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenVault();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '10px 20px',
                    borderRadius: 9999,
                    backgroundColor: '#111111',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  }}
                >
                  <Lock size={14} color="#E05A38" />
                  <span>Play &amp; Chat on Web</span>
                  <ChevronRight size={14} />
                </button>
              )}

              <a
                href="https://kanelijo.com/SecureBox.apk"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '10px 18px',
                  borderRadius: 9999,
                  backgroundColor: '#FFFFFF',
                  color: '#1C1917',
                  border: '1px solid #D6D3D1',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <Download size={14} color="#57534E" />
                <span>Android APK (53.4 MB)</span>
              </a>
            </div>
          </div>

          {/* 4 Stat Highlights */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
            }}
          >
            {[
              { val: '200+', label: 'Game Levels', sub: 'Infinite brick-smash gameplay' },
              { val: '6', label: 'Animal Companions', sub: 'Panda, cat, puppy & more' },
              { val: '0ms', label: 'Server Memory', sub: 'Pure zero-knowledge privacy' },
              { val: '24h', label: 'Ephemeral Rooms', sub: 'Self-destructing countdown' },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(231, 229, 228, 0.8)',
                  borderRadius: 16,
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: 22,
                    fontWeight: 600,
                    color: '#111111',
                    marginBottom: 2,
                  }}
                >
                  {stat.val}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1917' }}>{stat.label}</div>
                <div style={{ fontSize: 11.5, color: '#78716C', marginTop: 2 }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Section: How the secret door works */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#E05A38',
                marginBottom: 6,
              }}
            >
              SECRET ACCESS
            </div>
            <h2
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 24,
                fontWeight: 400,
                color: '#111111',
                margin: '0 0 4px 0',
              }}
            >
              How the secret door works
            </h2>
            <p style={{ fontSize: 13.5, color: '#78716C', margin: '0 0 16px 0' }}>
              No password screens. No obvious chat icons.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  step: '1',
                  title: 'Play Brick Smash',
                  desc: 'SecureBox opens as a normal arcade game with paddle physics, lives, gifts, sound, and a high score. Anyone who looks sees just a game.',
                },
                {
                  step: '2',
                  title: 'Hold your animal or enter PIN',
                  desc: 'Click and hold the companion animal for 3 seconds or tap the PIN icon. Your private local Hub Password unlocks the personal disguise.',
                },
                {
                  step: '3',
                  title: "You're in your vault",
                  desc: 'All active rooms, chat histories, encrypted photo shares, and partner channels load instantly in client-side decrypted memory.',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(231, 229, 228, 0.8)',
                    borderRadius: 16,
                    padding: '14px 18px',
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: '#111111',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {item.step}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111111', margin: '0 0 3px 0' }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: 12.5, lineHeight: 1.5, color: '#57534E', margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dark Tour Card (kanelijo.com quick tour banner) */}
          <div
            style={{
              backgroundColor: '#141518',
              borderRadius: 24,
              padding: '24px',
              color: '#FFFFFF',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#E05A38',
                marginBottom: 6,
              }}
            >
              QUICK TOUR
            </div>
            <h2
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 22,
                fontWeight: 400,
                color: '#FFFFFF',
                margin: '0 0 10px 0',
              }}
            >
              A tour that teaches the secret
            </h2>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: '#A8A29E', margin: '0 0 16px 0' }}>
              When a private message or invite arrives, a discreet number appears on your animal companion.
              There are never revealing system notifications or pop-ups.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#FFFFFF', marginBottom: 2 }}>
                  Secret Vault Gate
                </div>
                <div style={{ fontSize: 11.5, color: '#A8A29E' }}>
                  Central animal icon or PIN trigger unlocks chats.
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: 14,
                  padding: '12px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#FFFFFF', marginBottom: 2 }}>
                  Silent Message Counter
                </div>
                <div style={{ fontSize: 11.5, color: '#A8A29E' }}>
                  Gentle unread pulse without shoulder-surfer leak.
                </div>
              </div>
            </div>
          </div>

          {/* Section: What's inside (All Capabilities) */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#E05A38',
                marginBottom: 6,
              }}
            >
              VAULT CAPABILITIES
            </div>
            <h2
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 24,
                fontWeight: 400,
                color: '#111111',
                margin: '0 0 16px 0',
              }}
            >
              What&#x27;s inside
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 10 }}>
              {[
                {
                  icon: <Gamepad2 size={18} color="#D97757" />,
                  title: 'Hidden in plain sight',
                  desc: 'Nothing on screen says chat. Anyone who picks up your phone sees an arcade brick-breaker with bombs, powerups, and levels.',
                },
                {
                  icon: <ShieldCheck size={18} color="#2563eb" />,
                  title: 'Zero-Knowledge AES-GCM 256-Bit',
                  desc: 'Client-side PBKDF2 (100k rounds) derives encryption keys locally. Plaintext never touches any server or database.',
                },
                {
                  icon: <KeyRound size={18} color="#16a34a" />,
                  title: 'Two-Tier Decoupled Keys',
                  desc: 'Personal Hub Password locks your disguise entrance. 4-Digit Room Secret PIN is shared exclusively with your partner.',
                },
                {
                  icon: <Layers size={18} color="#8b5cf6" />,
                  title: 'Strict Room Isolation (Zero Bleed)',
                  desc: 'Each room lives in a separate sandbox (room_chat_<roomId>). Switching rooms flushes memory state immediately.',
                },
                {
                  icon: <Timer size={18} color="#ea580c" />,
                  title: 'Ephemeral 24-Hour Lifespan',
                  desc: 'Rooms and server buffers auto-expire after 24 hours. Extendable anytime by +24 hours with partner agreement.',
                },
                {
                  icon: <Bomb size={18} color="#dc2626" />,
                  title: 'Instant Panic Wipe',
                  desc: '1-tap Room Wipe destroys local keys, metadata, and messages while silently commanding partner device to purge theirs.',
                },
                {
                  icon: <Camera size={18} color="#0891b2" />,
                  title: 'Private Photo Sharing (<90KB)',
                  desc: 'In-browser canvas compression packages photos into lightweight JPEGs with fullscreen zoom and secure download.',
                },
                {
                  icon: <Radio size={18} color="#059669" />,
                  title: 'Encrypted Offline Relay Queue',
                  desc: 'Encrypted payloads are safely queued if your partner is offline, decrypted on arrival, then immediately wiped from server.',
                },
              ].map((feat, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(231, 229, 228, 0.8)',
                    borderRadius: 14,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: '#FAF9F6',
                      border: '1px solid #E7E5E4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {feat.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 13.5, fontWeight: 700, color: '#111111', margin: '0 0 2px 0' }}>
                      {feat.title}
                    </h3>
                    <p style={{ fontSize: 12, lineHeight: 1.45, color: '#57534E', margin: 0 }}>
                      {feat.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Pick your animal */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#E05A38',
                marginBottom: 6,
              }}
            >
              COMPANIONS
            </div>
            <h2
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 24,
                fontWeight: 400,
                color: '#111111',
                margin: '0 0 4px 0',
              }}
            >
              Pick your animal
            </h2>
            <p style={{ fontSize: 13.5, color: '#78716C', margin: '0 0 16px 0' }}>
              Your companion shows up in the game and in your secret vault.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              {animals.map((an, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(231, 229, 228, 0.8)',
                    borderRadius: 16,
                    padding: '12px 10px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: an.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <img
                      src={an.img}
                      alt={an.name}
                      style={{ width: 32, height: 32, objectFit: 'contain' }}
                    />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111111' }}>{an.name}</div>
                  <div style={{ fontSize: 10.5, color: '#78716C', marginTop: 2, lineHeight: 1.3 }}>
                    {an.trait}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Connect first, then chat */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(231, 229, 228, 0.8)',
              borderRadius: 20,
              padding: '20px',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#E05A38',
                marginBottom: 6,
              }}
            >
              IN-APP INVITE SYSTEM
            </div>
            <h3
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 20,
                fontWeight: 400,
                color: '#111111',
                margin: '0 0 6px 0',
              }}
            >
              Connect first, then chat
            </h3>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: '#57534E', margin: 0 }}>
              Nothing opens until both participants agree. Create a private room link with a 4-digit
              secret PIN. Share it directly with your partner. When they enter the PIN, the room locks
              between the two of you—no outsiders can ever enter.
            </p>
          </div>

          {/* Bottom Call to Action Card (kanelijo.com style) */}
          <div
            style={{
              backgroundColor: '#141518',
              borderRadius: 24,
              padding: '26px 20px',
              color: '#FFFFFF',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 24,
                fontWeight: 400,
                color: '#FFFFFF',
                margin: '0 0 6px 0',
              }}
            >
              Get SecureBox
            </h2>
            <p style={{ fontSize: 13, color: '#A8A29E', margin: '0 0 18px 0' }}>
              Built by Team43 &amp; Kanelijo. Play the arcade game or unlock the vault.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              <a
                href="https://kanelijo.com/SecureBox.apk"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 18px',
                  borderRadius: 9999,
                  backgroundColor: '#FFFFFF',
                  color: '#111111',
                  fontSize: 12.5,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <Download size={14} color="#111111" />
                <span>Download APK</span>
              </a>

              {onOpenVault && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenVault();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 18px',
                    borderRadius: 9999,
                    backgroundColor: '#E05A38',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Smartphone size={14} />
                  <span>Open Web Version</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
