// client/src/components/SecureboxPage.tsx
// Dedicated showcase page for https://thesecurebox.vercel.app/Securebox
// Features mobile mockup showcase, zero-knowledge security deep-dive,
// direct local APK download (/securebox.apk), and zero external branding.

import React, { useState } from 'react';
import {
  ShieldCheck,
  Gamepad2,
  KeyRound,
  Layers,
  Timer,
  Bomb,
  Camera,
  Radio,
  EyeOff,
  ChevronRight,
  Download,
  Lock,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Volume2,
  Gauge,
  Sparkles,
  Share2,
  Trash2,
  Clock,
  Eye,
  FileCode,
} from 'lucide-react';
import { BrickWallPeeker } from './BrickWallPeeker';

interface SecureboxPageProps {
  onLaunchApp?: () => void;
}

export const SecureboxPage: React.FC<SecureboxPageProps> = ({ onLaunchApp }) => {
  const [activeMockupIndex, setActiveMockupIndex] = useState(0);

  const mockups = [
    {
      id: 'game',
      tag: 'LAYER 1 · DISGUISE',
      title: 'Stealth Brick Smash Game',
      subtitle: 'An authentic retro arcade game that completely conceals your private vault.',
      image: '/mockups/mockup-game.jpg',
      badge: 'Game Camouflage',
      features: [
        'Fully playable arcade brick breaker with ball physics',
        'Bomb bricks with 25% blast radius chain reactions',
        'Ball speed controller (0.8x to 1.6x multiplier)',
        'Mute/unmute sound toggle with retro synth audio',
        'Stealth unread notification badge disguised on arcade icons',
        'Auto-locks immediately if you switch tabs or leave device idle',
      ],
    },
    {
      id: 'password',
      tag: 'LAYER 2 · HUB GATEWAY',
      title: 'Independent Hub Password',
      subtitle: 'Protects the game disguise on this device only. Decoupled from room encryption.',
      image: '/mockups/mockup-password.jpg',
      badge: 'Device Security',
      features: [
        'Two-step password creation with confirm verification',
        'Show/hide password visibility eye toggle',
        'Hashed locally using SHA-256 before storage',
        'Zero server communication — device-bound vault protection',
        '1-tap instant PIN reset option with session retention',
        'Completely separated from the 4-digit room secret encryption key',
      ],
    },
    {
      id: 'hub',
      tag: 'LAYER 3 · ROOM MANAGEMENT',
      title: 'SecureBox Secret Hub',
      subtitle: 'Create disposable rooms and manage your local saved encrypted inventory.',
      image: '/mockups/mockup-hub.jpg',
      badge: 'Room Control',
      features: [
        'Custom display handles for anonymous peer identification',
        'Unique 4-digit room secret PIN used for AES key derivation',
        'Saved Rooms inventory stored only on local device',
        'Room creation timestamp and date stamps',
        'Quick 1-tap room entrance with active key caching',
        'Instant room wipe and clean local deletion',
      ],
    },
    {
      id: 'room-link',
      tag: 'LAYER 4 · INSTANT ONBOARDING',
      title: 'One-Time Private Invite',
      subtitle: 'Generate ultra-short invite links that let partners join in a single tap.',
      image: '/mockups/mockup-room-link.jpg',
      badge: 'Encrypted Link',
      features: [
        'Clean short invite URLs formatted as /#<roomId>',
        'Out-of-band two-factor security: partner enters the 4-digit PIN',
        'URL hash immediately sanitized upon room opening',
        'Dual-step partner onboarding: room unlock + local hub password',
        'Prevents link reuse or accidental page reload loops',
        'Zero metadata recorded on centralized servers',
      ],
    },
    {
      id: 'chat',
      tag: 'LAYER 5 · VAULT CHAT',
      title: 'Zero-Knowledge Encrypted Chat',
      subtitle: 'Ephemeral messaging with real-time peer sync and 24-hour self-destruct.',
      image: '/mockups/mockup-chat.jpg',
      badge: 'AES-GCM-256',
      features: [
        'Military-grade AES-GCM 256-bit client-side encryption',
        'PBKDF2 key derivation with 100,000 hash iterations',
        'Live 24-hour countdown timer with +24h extension button',
        'Real-time peer presence & typing indicator feedback',
        'Canvas photo compression under 90KB for direct zero-trace sharing',
        'Complete room purge: wipes chat on both devices simultaneously',
      ],
    },
  ];

  const handleLaunch = () => {
    if (onLaunchApp) {
      onLaunchApp();
    } else {
      window.history.pushState(null, '', '/');
      window.location.href = '/';
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#FAF9F6',
        color: '#141518',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        lineHeight: 1.6,
        overflowX: 'hidden',
      }}
    >
      {/* ─── Top Navigation Bar ────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'rgba(250, 249, 246, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #E7E5E4',
          padding: '12px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Logo & Brand */}
          <div
            onClick={handleLaunch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <BrickWallPeeker width={40} height={32} />
            <div>
              <div
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: '15px',
                  letterSpacing: '1px',
                  color: '#141518',
                  lineHeight: 1.2,
                }}
              >
                SECURE<span style={{ color: '#D96B43' }}>BOX</span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#78716C',
                  fontWeight: 500,
                  letterSpacing: '0.5px',
                }}
              >
                Stealth Disguise &amp; Encrypted Vault
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a
              href="/securebox.apk"
              download="SecureBox.apk"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '10px',
                backgroundColor: '#141518',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              }}
            >
              <Download size={15} />
              <span>Download APK</span>
            </a>

            <button
              onClick={handleLaunch}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '10px',
                backgroundColor: '#D96B43',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(217, 107, 67, 0.25)',
              }}
            >
              <Gamepad2 size={16} />
              <span>Play Game</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ─────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '64px 24px 48px',
          maxWidth: '1200px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '999px',
            backgroundColor: '#F5EBE6',
            color: '#D96B43',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            marginBottom: '20px',
            textTransform: 'uppercase',
          }}
        >
          <ShieldCheck size={16} />
          <span>Zero-Knowledge End-to-End Encrypted Messenger</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(32px, 5.5vw, 56px)',
            fontWeight: 800,
            letterSpacing: '-1.5px',
            lineHeight: 1.15,
            color: '#141518',
            maxWidth: '900px',
            margin: '0 auto 20px',
          }}
        >
          Looks like an arcade game.{' '}
          <span style={{ color: '#D96B43' }}>Opens like a military vault.</span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(16px, 2vw, 19px)',
            color: '#57534E',
            maxWidth: '720px',
            margin: '0 auto 36px',
            fontWeight: 400,
          }}
        >
          Disguised behind a fully playable Brick Smash arcade game. Features isolated
          ephemeral rooms, 24-hour self-destruct timers, client-side WebCrypto
          AES-GCM-256 encryption, and zero server storage.
        </p>

        {/* Hero Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '14px',
            marginBottom: '40px',
          }}
        >
          <a
            href="/securebox.apk"
            download="SecureBox.apk"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 28px',
              borderRadius: '14px',
              backgroundColor: '#141518',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 8px 20px rgba(20, 21, 24, 0.25)',
              transition: 'transform 0.15s ease',
            }}
          >
            <Download size={20} />
            <span>Download Android APK</span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: 'rgba(255,255,255,0.18)',
                marginLeft: '4px',
              }}
            >
              105 MB
            </span>
          </a>

          <button
            onClick={handleLaunch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 28px',
              borderRadius: '14px',
              backgroundColor: '#D96B43',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(217, 107, 67, 0.35)',
              transition: 'transform 0.15s ease',
            }}
          >
            <Gamepad2 size={20} />
            <span>Launch Web Game Disguise</span>
            <ArrowRight size={18} />
          </button>
        </div>

        {/* Quick Highlights Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            maxWidth: '1000px',
            margin: '0 auto',
            textAlign: 'left',
          }}
        >
          {[
            {
              icon: Lock,
              title: 'AES-GCM-256',
              desc: 'Client-side WebCrypto encryption. Server never sees plaintext or keys.',
            },
            {
              icon: Gamepad2,
              title: 'Complete Camouflage',
              desc: 'Full Brick Smash game with retro sound, bombs, and speed controls.',
            },
            {
              icon: Timer,
              title: '24-Hour Ephemeral',
              desc: 'Automatic timer destruction. Zero trace, zero logs, zero history.',
            },
            {
              icon: EyeOff,
              title: 'Auto-Lock Disguise',
              desc: 'Tab change or 60s idle instantly reverts back to the arcade game.',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #E7E5E4',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#F5EBE6',
                  color: '#D96B43',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                }}
              >
                <item.icon size={20} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '13px', color: '#78716C', lineHeight: 1.4 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Interactive Phone Mockup Showcase ────────────────────────────── */}
      <section
        style={{
          padding: '60px 24px 80px',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E7E5E4',
          borderBottom: '1px solid #E7E5E4',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1px',
                color: '#D96B43',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}
            >
              Live Application Showcase
            </div>
            <h2
              style={{
                fontSize: 'clamp(26px, 4vw, 38px)',
                fontWeight: 800,
                letterSpacing: '-1px',
                color: '#141518',
                marginBottom: '12px',
              }}
            >
              Tour the Multi-Tier Security Experience
            </h2>
            <p style={{ fontSize: '16px', color: '#78716C', maxWidth: '640px', margin: '0 auto' }}>
              From public arcade disguise to military-grade encrypted communication. Tap
              any tier below to inspect the interface.
            </p>
          </div>

          {/* Interactive Tier Selector Tabs */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '48px',
            }}
          >
            {mockups.map((mockup, index) => {
              const isSelected = activeMockupIndex === index;
              return (
                <button
                  key={mockup.id}
                  onClick={() => setActiveMockupIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '999px',
                    backgroundColor: isSelected ? '#141518' : '#F5F5F4',
                    color: isSelected ? '#FFFFFF' : '#44403C',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(20, 21, 24, 0.2)' : 'none',
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? '#D96B43' : '#A8A29E',
                    }}
                  />
                  <span>{mockup.title}</span>
                </button>
              );
            })}
          </div>

          {/* Mockup Showcase Dual View (Realistic Smartphone Frame + Deep Dive Card) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '48px',
              alignItems: 'center',
              backgroundColor: '#FAF9F6',
              borderRadius: '28px',
              padding: 'clamp(24px, 4vw, 48px)',
              border: '1px solid #E7E5E4',
            }}
          >
            {/* Phone Mockup Frame */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '320px',
                  maxWidth: '100%',
                  borderRadius: '44px',
                  backgroundColor: '#1E2024',
                  padding: '12px',
                  boxShadow:
                    '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                  position: 'relative',
                }}
              >
                {/* Phone Speaker Cutout */}
                <div
                  style={{
                    position: 'absolute',
                    top: '22px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '60px',
                    height: '4px',
                    backgroundColor: '#374151',
                    borderRadius: '999px',
                    zIndex: 20,
                  }}
                />

                {/* Inner Bezel & Screen */}
                <div
                  style={{
                    borderRadius: '34px',
                    overflow: 'hidden',
                    backgroundColor: '#FFFFFF',
                    aspectRatio: '9 / 18.5',
                    position: 'relative',
                    border: '2px solid #000000',
                  }}
                >
                  <img
                    src={mockups[activeMockupIndex].image}
                    alt={mockups[activeMockupIndex].title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Deep Dive Feature Details */}
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  backgroundColor: '#F5EBE6',
                  color: '#D96B43',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  marginBottom: '16px',
                }}
              >
                {mockups[activeMockupIndex].tag}
              </div>

              <h3
                style={{
                  fontSize: 'clamp(24px, 3vw, 32px)',
                  fontWeight: 800,
                  color: '#141518',
                  lineHeight: 1.2,
                  marginBottom: '12px',
                }}
              >
                {mockups[activeMockupIndex].title}
              </h3>

              <p
                style={{
                  fontSize: '16px',
                  color: '#57534E',
                  marginBottom: '24px',
                  lineHeight: 1.5,
                }}
              >
                {mockups[activeMockupIndex].subtitle}
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginBottom: '32px',
                }}
              >
                {mockups[activeMockupIndex].features.map((feat, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        color: '#22C55E',
                        marginTop: '2px',
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircle2 size={18} />
                    </div>
                    <span style={{ fontSize: '14px', color: '#292524', fontWeight: 500 }}>
                      {feat}
                    </span>
                  </div>
                ))}
              </div>

              {/* Navigation within Mockups */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={() =>
                    setActiveMockupIndex((prev) =>
                      prev > 0 ? prev - 1 : mockups.length - 1
                    )
                  }
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #D6D3D1',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#44403C',
                  }}
                >
                  Previous Screen
                </button>

                <button
                  onClick={() =>
                    setActiveMockupIndex((prev) =>
                      prev < mockups.length - 1 ? prev + 1 : 0
                    )
                  }
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#141518',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Next Screen
                </button>

                <span style={{ fontSize: '13px', color: '#A8A29E', marginLeft: '8px' }}>
                  {activeMockupIndex + 1} of {mockups.length}
                </span>
              </div>
            </div>
          </div>

          {/* 5-Screen Horizontal Gallery */}
          <div style={{ marginTop: '64px' }}>
            <h4
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#141518',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              All 5 Application Screens at a Glance
            </h4>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '18px',
              }}
            >
              {mockups.map((m, idx) => (
                <div
                  key={m.id}
                  onClick={() => setActiveMockupIndex(idx)}
                  style={{
                    backgroundColor: '#FAF9F6',
                    borderRadius: '16px',
                    border:
                      activeMockupIndex === idx
                        ? '2px solid #D96B43'
                        : '1px solid #E7E5E4',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow:
                      activeMockupIndex === idx
                        ? '0 6px 18px rgba(217, 107, 67, 0.2)'
                        : 'none',
                  }}
                >
                  <div
                    style={{
                      height: '240px',
                      overflow: 'hidden',
                      backgroundColor: '#1E2024',
                    }}
                  >
                    <img
                      src={m.image}
                      alt={m.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'top center',
                      }}
                    />
                  </div>
                  <div style={{ padding: '12px' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#D96B43',
                        marginBottom: '2px',
                      }}
                    >
                      {m.badge}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#141518',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {m.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Security Architecture Deep-Dive ───────────────────────────────── */}
      <section style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: '#D96B43',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Zero-Knowledge Specification
          </div>
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 800,
              letterSpacing: '-1px',
              color: '#141518',
              marginBottom: '16px',
            }}
          >
            Engineered for Total Secrecy
          </h2>
          <p style={{ fontSize: '16px', color: '#78716C', maxWidth: '640px', margin: '0 auto' }}>
            SecureBox was designed from the ground up to guarantee that even the servers
            routing your messages cannot decrypt your communications.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Card 1: Two-Tier Decoupled Keys */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid #E7E5E4',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#F5EBE6',
                color: '#D96B43',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <KeyRound size={24} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
              Two-Tier Decoupled Authentication
            </h3>
            <p style={{ fontSize: '14px', color: '#57534E', lineHeight: 1.6, marginBottom: '16px' }}>
              Your personal <strong>Hub Entrance Password</strong> protects local device access
              from the game disguise. The shared <strong>4-Digit Room Secret PIN</strong> is
              strictly used for AES key derivation with your partner. The two never overlap or
              clash.
            </p>
            <div
              style={{
                fontSize: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#FAF9F6',
                border: '1px solid #E7E5E4',
                color: '#44403C',
                fontFamily: 'monospace',
              }}
            >
              Key 1: SHA-256(HubPassword) ➔ Local Device
              <br />
              Key 2: PBKDF2(RoomPIN + RoomId) ➔ AES-GCM-256
            </div>
          </div>

          {/* Card 2: Zero Server Footprint */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid #E7E5E4',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
              Zero-Knowledge Server Infrastructure
            </h3>
            <p style={{ fontSize: '14px', color: '#57534E', lineHeight: 1.6, marginBottom: '16px' }}>
              Relay servers only route encrypted ciphertext blobs. No chat logs, no contact
              lists, and no user profiles are ever recorded. Encryption and decryption occur
              solely inside your device browser using native WebCrypto.
            </p>
            <div
              style={{
                fontSize: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#FAF9F6',
                border: '1px solid #E7E5E4',
                color: '#44403C',
                fontFamily: 'monospace',
              }}
            >
              IV: 12-byte cryptographic random salt
              <br />
              Payload: AES-GCM ciphertext + auth tag
            </div>
          </div>

          {/* Card 3: Strict Sandboxed Chat Isolation */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid #E7E5E4',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <Layers size={24} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
              Strict Sandboxed Room Isolation
            </h3>
            <p style={{ fontSize: '14px', color: '#57534E', lineHeight: 1.6, marginBottom: '16px' }}>
              Each conversation room operates within an isolated cryptographic boundary.
              Active message buffers are instantly flushed upon room transitions, and local
              storage keys are segregated by room ID.
            </p>
            <div
              style={{
                fontSize: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#FAF9F6',
                border: '1px solid #E7E5E4',
                color: '#44403C',
                fontFamily: 'monospace',
              }}
            >
              Storage: room_chat_&#123;roomId&#125; (isolated)
              <br />
              State: Flushed on room switch (setMessages([]))
            </div>
          </div>

          {/* Card 4: Ephemeral 24h Countdown & Instant Purge */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid #E7E5E4',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <Timer size={24} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
              Auto-Destruct &amp; Simultaneous Purge
            </h3>
            <p style={{ fontSize: '14px', color: '#57534E', lineHeight: 1.6, marginBottom: '16px' }}>
              Rooms permanently expire after 24 hours unless granted a +24h extension.
              Either participant can trigger a nuclear wipe signal that simultaneously deletes
              chat history on both devices in real time.
            </p>
            <div
              style={{
                fontSize: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#FAF9F6',
                border: '1px solid #E7E5E4',
                color: '#44403C',
                fontFamily: 'monospace',
              }}
            >
              Broadcast: wipe_room ➔ Dual device local wipe
              <br />
              Default lifespan: 86,400,000 ms (24 hours)
            </div>
          </div>

          {/* Card 5: In-Browser Photo Compression */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid #E7E5E4',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#F3E8FF',
                color: '#9333EA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <Camera size={24} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
              Privacy Canvas Photo Compression
            </h3>
            <p style={{ fontSize: '14px', color: '#57534E', lineHeight: 1.6, marginBottom: '16px' }}>
              Photos are automatically downscaled and re-encoded locally via HTML5 Canvas
              under 90KB before AES encryption. This permits direct peer-to-peer payload
              delivery without cloud storage buckets.
            </p>
            <div
              style={{
                fontSize: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#FAF9F6',
                border: '1px solid #E7E5E4',
                color: '#44403C',
                fontFamily: 'monospace',
              }}
            >
              Compression target: &lt; 90 KB
              <br />
              Pipeline: Canvas ➔ WebP/JPEG ➔ AES-GCM
            </div>
          </div>

          {/* Card 6: Stealth Game Camouflage */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid #E7E5E4',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#F5EBE6',
                color: '#D96B43',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <Gamepad2 size={24} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
              Deep Game Disguise &amp; Anti-Snoop
            </h3>
            <p style={{ fontSize: '14px', color: '#57534E', lineHeight: 1.6, marginBottom: '16px' }}>
              The disguise layer is a complete arcade experience featuring dense brick
              arrangements, bomb powerups that shatter 25% of bricks, sound switches, ball
              speed adjustments, and instant lock upon app switching.
            </p>
            <div
              style={{
                fontSize: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#FAF9F6',
                border: '1px solid #E7E5E4',
                color: '#44403C',
                fontFamily: 'monospace',
              }}
            >
              Mechanics: 25% bomb blast, 0.8x-1.6x speed
              <br />
              Auto-lock: visibilitychange + 60s idle timer
            </div>
          </div>
        </div>
      </section>

      {/* ─── Direct APK Download Banner ───────────────────────────────────── */}
      <section
        id="download"
        style={{
          padding: '80px 24px',
          backgroundColor: '#141518',
          color: '#FFFFFF',
        }}
      >
        <div
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#D96B43',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: '20px',
              textTransform: 'uppercase',
            }}
          >
            <Smartphone size={16} />
            <span>Standalone Android Application</span>
          </div>

          <h2
            style={{
              fontSize: 'clamp(28px, 4.5vw, 44px)',
              fontWeight: 800,
              letterSpacing: '-1px',
              marginBottom: '16px',
            }}
          >
            Install SecureBox Directly on Your Phone
          </h2>

          <p
            style={{
              fontSize: '16px',
              color: '#A8A29E',
              maxWidth: '680px',
              margin: '0 auto 36px',
            }}
          >
            Get the full native mobile experience with vibration haptics, instant offline
            storage, push camouflage alerts, and zero-store tracking. Download the official
            APK directly below.
          </p>

          {/* Download Box Card */}
          <div
            style={{
              backgroundColor: '#1E2024',
              borderRadius: '24px',
              padding: '36px',
              maxWidth: '640px',
              margin: '0 auto 32px',
              border: '1px solid #2E333D',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                borderBottom: '1px solid #2E333D',
                paddingBottom: '20px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#D96B43',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                  }}
                >
                  <Smartphone size={26} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '18px', color: '#FFFFFF' }}>
                    SecureBox.apk
                  </div>
                  <div style={{ fontSize: '13px', color: '#A8A29E' }}>
                    Release v1.0.0 · Android 8.0+
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: '13px',
                  color: '#22C55E',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>Verified Direct Build</span>
              </div>
            </div>

            {/* APK Metadata specs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  backgroundColor: '#141518',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #2A2E37',
                }}
              >
                <div style={{ fontSize: '11px', color: '#78716C', textTransform: 'uppercase' }}>
                  Package
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#E5E7EB' }}>
                  standalone.apk
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#141518',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #2A2E37',
                }}
              >
                <div style={{ fontSize: '11px', color: '#78716C', textTransform: 'uppercase' }}>
                  File Size
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#E5E7EB' }}>
                  ~105 MB
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#141518',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #2A2E37',
                }}
              >
                <div style={{ fontSize: '11px', color: '#78716C', textTransform: 'uppercase' }}>
                  Architecture
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#E5E7EB' }}>
                  Universal ARM/x86
                </div>
              </div>
            </div>

            {/* Direct Download Button */}
            <a
              href="/securebox.apk"
              download="SecureBox.apk"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                width: '100%',
                padding: '16px 24px',
                borderRadius: '14px',
                backgroundColor: '#D96B43',
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 8px 24px rgba(217, 107, 67, 0.4)',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={20} />
              <span>Download SecureBox.apk Now</span>
            </a>
          </div>

          <div style={{ fontSize: '13px', color: '#78716C' }}>
            To install: open the downloaded APK on your Android device and tap &ldquo;Install&rdquo;.
            Allow &ldquo;Install unknown apps&rdquo; if prompted.
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: '48px 24px',
          backgroundColor: '#FAF9F6',
          borderTop: '1px solid #E7E5E4',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BrickWallPeeker width={34} height={28} />
            <span
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '14px',
                color: '#141518',
              }}
            >
              SECURE<span style={{ color: '#D96B43' }}>BOX</span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleLaunch}
              style={{
                background: 'none',
                border: 'none',
                color: '#57534E',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Play Game Disguise
            </button>
            <a
              href="/securebox.apk"
              download="SecureBox.apk"
              style={{
                color: '#57534E',
                fontSize: '13px',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Download APK
            </a>
            <span style={{ color: '#A8A29E' }}>•</span>
            <span style={{ color: '#78716C', fontSize: '13px' }}>
              Zero-Knowledge AES-GCM-256 Architecture
            </span>
          </div>

          <div style={{ fontSize: '12px', color: '#A8A29E', marginTop: '8px' }}>
            &copy; 2026 SecureBox. All rights reserved. Zero server logs, zero message retention.
          </div>
        </div>
      </footer>
    </div>
  );
};
