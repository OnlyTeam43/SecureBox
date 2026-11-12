// client/src/components/SecureboxPage.tsx
// Dedicated showcase page for https://thesecurebox.vercel.app/Securebox
// Features mobile mockup showcase, zero-knowledge security deep-dive,
// direct local 54MB APK download (/securebox.apk), and zero external branding.

import React, { useState, useEffect } from 'react';
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
  UploadCloud,
  ChevronDown,
  Flame,
} from 'lucide-react';
import { BrickWallPeeker } from './BrickWallPeeker';
import { SECUREBOX_FAQS } from '../utils/seo';

interface SecureboxPageProps {
  onLaunchApp?: () => void;
  onOpenQuickDrop?: () => void;
}

export const SecureboxPage: React.FC<SecureboxPageProps> = ({ onLaunchApp, onOpenQuickDrop }) => {
  const [activeMockupIndex, setActiveMockupIndex] = useState(0);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const handleOpenDropbox = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (onOpenQuickDrop) {
      onOpenQuickDrop();
    } else {
      window.history.pushState(null, '', '/dropbox');
      window.location.href = '/dropbox';
    }
  };

  // Preload all 5 mockup screenshot images
  useEffect(() => {
    const images = [
      '/mockups/mockup-game.jpg',
      '/mockups/mockup-password.jpg',
      '/mockups/mockup-hub.jpg',
      '/mockups/mockup-room-link.jpg',
      '/mockups/mockup-chat.jpg',
    ];
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

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

  const scrollToMockups = () => {
    const el = document.getElementById('mockups-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      id="securebox-scroll-container"
      style={{
        width: '100%',
        height: '100dvh',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        backgroundColor: '#FAF9F6',
        color: '#141518',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        lineHeight: 1.6,
      }}
    >
      {/* ─── Top Navigation Bar ────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'rgba(250, 249, 246, 0.94)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #E7E5E4',
          padding: '8px 16px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Logo & Brand */}
          <div
            onClick={handleLaunch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <BrickWallPeeker width={32} height={26} />
            <div>
              <div
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: '13px',
                  letterSpacing: '0.5px',
                  color: '#141518',
                  lineHeight: 1.2,
                }}
              >
                SECURE<span style={{ color: '#D96B43' }}>BOX</span>
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: '#78716C',
                  fontWeight: 500,
                }}
              >
                Stealth Disguise &amp; Vault
              </div>
            </div>
          </div>

          {/* Compact Small Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenQuickDrop && (
              <button
                onClick={onOpenQuickDrop}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 11px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  color: '#D96B43',
                  border: '1px solid #E7E5E4',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                }}
              >
                <UploadCloud size={13} />
                <span>Dropbox · QuickDrop</span>
              </button>
            )}

            <a
              href="/securebox.apk"
              download="SecureBox.apk"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 11px',
                borderRadius: '8px',
                backgroundColor: '#141518',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
              }}
            >
              <Download size={12} />
              <span>Download APK</span>
            </a>

            <button
              onClick={handleLaunch}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 11px',
                borderRadius: '8px',
                backgroundColor: '#D96B43',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(217, 107, 67, 0.22)',
              }}
            >
              <Gamepad2 size={13} />
              <span>Play Game</span>
            </button>
          </div>
        </div>
      </header>
      <main>

      {/* ─── Hero Section ─────────────────────────────────────────────────── */}
      <section
        style={{
          padding: '48px 20px 36px',
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
            padding: '5px 12px',
            borderRadius: '999px',
            backgroundColor: '#F5EBE6',
            color: '#D96B43',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            marginBottom: '16px',
            textTransform: 'uppercase',
          }}
        >
          <ShieldCheck size={14} />
          <span>Zero-Knowledge End-to-End Encrypted Messenger</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(28px, 5vw, 50px)',
            fontWeight: 800,
            letterSpacing: '-1.2px',
            lineHeight: 1.15,
            color: '#141518',
            maxWidth: '860px',
            margin: '0 auto 16px',
          }}
        >
          Looks like an arcade game.{' '}
          <span style={{ color: '#D96B43' }}>Opens like a military vault.</span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(15px, 2vw, 18px)',
            color: '#57534E',
            maxWidth: '680px',
            margin: '0 auto 28px',
            fontWeight: 400,
          }}
        >
          Disguised behind an authentic Brick Smash game. Ephemeral 24-hour private chat
          rooms, zero server logs, client-side WebCrypto AES-GCM-256 encryption, and instant self-destruct.
        </p>

        {/* Hero Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          <a
            href="/securebox.apk"
            download="SecureBox.apk"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#141518',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 6px 18px rgba(20, 21, 24, 0.22)',
            }}
          >
            <Download size={18} />
            <span>Download Android APK</span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 7px',
                borderRadius: '999px',
                backgroundColor: 'rgba(255,255,255,0.18)',
                marginLeft: '4px',
              }}
            >
              54 MB
            </span>
          </a>

          <button
            onClick={handleLaunch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#D96B43',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(217, 107, 67, 0.3)',
            }}
          >
            <Gamepad2 size={18} />
            <span>Launch Web Game Disguise</span>
            <ArrowRight size={16} />
          </button>

          <button
            onClick={scrollToMockups}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 18px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              color: '#44403C',
              border: '1px solid #D6D3D1',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Smartphone size={16} color="#D96B43" />
            <span>View 5 App Mockups</span>
          </button>
        </div>
      </section>

      {/* ─── Interactive Phone Mockup Showcase ────────────────────────────── */}
      <section
        id="mockups-section"
        style={{
          padding: '48px 20px 64px',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E7E5E4',
          borderBottom: '1px solid #E7E5E4',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
                color: '#D96B43',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              Live App Screenshots &amp; Mockups
            </div>
            <h2
              style={{
                fontSize: 'clamp(24px, 3.5vw, 36px)',
                fontWeight: 800,
                letterSpacing: '-0.8px',
                color: '#141518',
                marginBottom: '8px',
              }}
            >
              Explore the 5 Application Layers
            </h2>
            <p style={{ fontSize: '15px', color: '#78716C', maxWidth: '600px', margin: '0 auto' }}>
              Tap any layer below to inspect the actual interface and capabilities.
            </p>
          </div>

          {/* Interactive Tier Selector Tabs */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '36px',
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
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '999px',
                    backgroundColor: isSelected ? '#141518' : '#F5F5F4',
                    color: isSelected ? '#FFFFFF' : '#44403C',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 3px 10px rgba(20, 21, 24, 0.2)' : 'none',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '36px',
              alignItems: 'center',
              backgroundColor: '#FAF9F6',
              borderRadius: '24px',
              padding: 'clamp(20px, 3vw, 40px)',
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
                  width: '300px',
                  maxWidth: '100%',
                  borderRadius: '40px',
                  backgroundColor: '#1E2024',
                  padding: '10px',
                  boxShadow:
                    '0 20px 50px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.12)',
                  position: 'relative',
                }}
              >
                {/* Phone Speaker Cutout */}
                <div
                  style={{
                    position: 'absolute',
                    top: '18px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '50px',
                    height: '4px',
                    backgroundColor: '#374151',
                    borderRadius: '999px',
                    zIndex: 20,
                  }}
                />

                {/* Inner Bezel & Screen */}
                <div
                  style={{
                    borderRadius: '32px',
                    overflow: 'hidden',
                    backgroundColor: '#FAF9F5',
                    aspectRatio: '503 / 1024',
                    position: 'relative',
                    border: '2px solid #000000',
                  }}
                >
                  <img
                    src={mockups[activeMockupIndex].image}
                    alt={`${mockups[activeMockupIndex].title} — ${mockups[activeMockupIndex].subtitle}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'top center',
                      display: 'block',
                      backgroundColor: '#FAF9F5',
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
                  padding: '4px 10px',
                  borderRadius: '999px',
                  backgroundColor: '#F5EBE6',
                  color: '#D96B43',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                }}
              >
                {mockups[activeMockupIndex].tag}
              </div>

              <h3
                style={{
                  fontSize: 'clamp(22px, 2.5vw, 28px)',
                  fontWeight: 800,
                  color: '#141518',
                  lineHeight: 1.25,
                  marginBottom: '10px',
                }}
              >
                {mockups[activeMockupIndex].title}
              </h3>

              <p
                style={{
                  fontSize: '15px',
                  color: '#57534E',
                  marginBottom: '20px',
                  lineHeight: 1.5,
                }}
              >
                {mockups[activeMockupIndex].subtitle}
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginBottom: '28px',
                }}
              >
                {mockups[activeMockupIndex].features.map((feat, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        color: '#22C55E',
                        marginTop: '2px',
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <span style={{ fontSize: '13.5px', color: '#292524', fontWeight: 500 }}>
                      {feat}
                    </span>
                  </div>
                ))}
              </div>

              {/* Navigation within Mockups */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={() =>
                    setActiveMockupIndex((prev) =>
                      prev > 0 ? prev - 1 : mockups.length - 1
                    )
                  }
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #D6D3D1',
                    fontSize: '12px',
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
                    padding: '7px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#141518',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Next Screen
                </button>

                <span style={{ fontSize: '12px', color: '#A8A29E', marginLeft: '6px' }}>
                  {activeMockupIndex + 1} of {mockups.length}
                </span>
              </div>
            </div>
          </div>

          {/* 5-Screen Horizontal Gallery */}
          <div style={{ marginTop: '48px' }}>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#141518',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              All 5 Application Screens at a Glance (Tap to View)
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '14px',
              }}
            >
              {mockups.map((m, idx) => (
                <div
                  key={m.id}
                  onClick={() => setActiveMockupIndex(idx)}
                  style={{
                    backgroundColor: '#FAF9F6',
                    borderRadius: '14px',
                    border:
                      activeMockupIndex === idx
                        ? '2px solid #D96B43'
                        : '1px solid #E7E5E4',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow:
                      activeMockupIndex === idx
                        ? '0 4px 14px rgba(217, 107, 67, 0.2)'
                        : 'none',
                  }}
                >
                  <div
                    style={{
                      height: '220px',
                      overflow: 'hidden',
                      backgroundColor: '#FAF9F5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={m.image}
                      alt={`${m.title} — SecureBox ${m.badge}`}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'top center',
                        display: 'block',
                      }}
                    />
                  </div>
                  <div style={{ padding: '10px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#D96B43',
                        marginBottom: '2px',
                      }}
                    >
                      {m.badge}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
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

      {/* ─── Architecture Highlights Row ─────────────────────────────────── */}
      <section style={{ padding: '36px 20px 20px', maxWidth: '1100px', margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
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
                borderRadius: '14px',
                padding: '18px',
                border: '1px solid #E7E5E4',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#F5EBE6',
                  color: '#D96B43',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '10px',
                }}
              >
                <item.icon size={18} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '3px' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '12px', color: '#78716C', lineHeight: 1.4 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Security Architecture Deep-Dive ───────────────────────────────── */}
      <section style={{ padding: '64px 20px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: '#D96B43',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Zero-Knowledge Specification
          </div>
          <h2
            style={{
              fontSize: 'clamp(24px, 3.5vw, 36px)',
              fontWeight: 800,
              letterSpacing: '-0.8px',
              color: '#141518',
              marginBottom: '12px',
            }}
          >
            Engineered for Total Secrecy
          </h2>
          <p style={{ fontSize: '15px', color: '#78716C', maxWidth: '600px', margin: '0 auto' }}>
            SecureBox was designed from the ground up to guarantee that even the servers
            routing your messages cannot decrypt your communications.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Card 1: Two-Tier Decoupled Keys */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #E7E5E4',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#F5EBE6',
                color: '#D96B43',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <KeyRound size={20} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              Two-Tier Decoupled Authentication
            </h3>
            <p style={{ fontSize: '13.5px', color: '#57534E', lineHeight: 1.55, marginBottom: '14px' }}>
              Your personal <strong>Hub Entrance Password</strong> protects local device access
              from the game disguise. The shared <strong>4-Digit Room Secret PIN</strong> is
              strictly used for AES key derivation with your partner. The two never overlap or clash.
            </p>
            <div
              style={{
                fontSize: '11px',
                padding: '8px 12px',
                borderRadius: '6px',
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
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #E7E5E4',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              Zero-Knowledge Server Architecture
            </h3>
            <p style={{ fontSize: '13.5px', color: '#57534E', lineHeight: 1.55, marginBottom: '14px' }}>
              Relay servers only route encrypted ciphertext blobs. No chat logs, no contact
              lists, and no user profiles are ever recorded. Encryption and decryption occur
              solely inside your device browser using native WebCrypto.
            </p>
            <div
              style={{
                fontSize: '11px',
                padding: '8px 12px',
                borderRadius: '6px',
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
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #E7E5E4',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Layers size={20} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              Strict Sandboxed Room Isolation
            </h3>
            <p style={{ fontSize: '13.5px', color: '#57534E', lineHeight: 1.55, marginBottom: '14px' }}>
              Each conversation room operates within an isolated cryptographic boundary.
              Active message buffers are instantly flushed upon room transitions, and local
              storage keys are segregated by room ID.
            </p>
            <div
              style={{
                fontSize: '11px',
                padding: '8px 12px',
                borderRadius: '6px',
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
        </div>
      </section>

      {/* ─── Direct 54MB APK Download Banner ─────────────────────────────────── */}
      <section
        id="download"
        style={{
          padding: '60px 20px',
          backgroundColor: '#141518',
          color: '#FFFFFF',
        }}
      >
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#D96B43',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: '16px',
              textTransform: 'uppercase',
            }}
          >
            <Smartphone size={14} />
            <span>Standalone Android Application</span>
          </div>

          <h2
            style={{
              fontSize: 'clamp(24px, 4vw, 38px)',
              fontWeight: 800,
              letterSpacing: '-0.8px',
              marginBottom: '12px',
            }}
          >
            Install SecureBox Directly on Your Phone
          </h2>

          <p
            style={{
              fontSize: '15px',
              color: '#A8A29E',
              maxWidth: '620px',
              margin: '0 auto 28px',
            }}
          >
            Get the full native mobile experience with vibration haptics, instant offline
            storage, push camouflage alerts, and zero-store tracking. Download the official
            54 MB APK directly below.
          </p>

          {/* Download Box Card */}
          <div
            style={{
              backgroundColor: '#1E2024',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '560px',
              margin: '0 auto 24px',
              border: '1px solid #2E333D',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5)',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                borderBottom: '1px solid #2E333D',
                paddingBottom: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#D96B43',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                  }}
                >
                  <Smartphone size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: '#FFFFFF' }}>
                    SecureBox.apk
                  </div>
                  <div style={{ fontSize: '12px', color: '#A8A29E' }}>
                    Release v1.0.0 · Android 8.0+
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  color: '#22C55E',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <CheckCircle2 size={14} />
                <span>Verified Direct Build</span>
              </div>
            </div>

            {/* APK Metadata specs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  backgroundColor: '#141518',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #2A2E37',
                }}
              >
                <div style={{ fontSize: '10px', color: '#78716C', textTransform: 'uppercase' }}>
                  Package
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#E5E7EB' }}>
                  standalone.apk
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#141518',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #2A2E37',
                }}
              >
                <div style={{ fontSize: '10px', color: '#78716C', textTransform: 'uppercase' }}>
                  File Size
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#22C55E' }}>
                  ~54 MB
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#141518',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #2A2E37',
                }}
              >
                <div style={{ fontSize: '10px', color: '#78716C', textTransform: 'uppercase' }}>
                  Architecture
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#E5E7EB' }}>
                  Universal ARM
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
                gap: '8px',
                width: '100%',
                padding: '13px 20px',
                borderRadius: '12px',
                backgroundColor: '#D96B43',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 6px 18px rgba(217, 107, 67, 0.35)',
                boxSizing: 'border-box',
              }}
            >
              <Download size={18} />
              <span>Download SecureBox.apk (54 MB)</span>
            </a>
          </div>

          <div style={{ fontSize: '12px', color: '#78716C' }}>
            To install: open the downloaded APK on your Android device and tap &ldquo;Install&rdquo;.
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      {/* ─── Companion Dropbox (/dropbox) Spotlight Section ─────────────────────── */}
      <section
        aria-labelledby="dropbox-companion-heading"
        style={{
          padding: '52px 20px',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E7E5E4',
          borderBottom: '1px solid #E7E5E4',
        }}
      >
        <div
          style={{
            maxWidth: '960px',
            margin: '0 auto',
            backgroundColor: '#FAF9F6',
            borderRadius: '20px',
            border: '1px solid #E7E5E4',
            padding: '28px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
          }}
        >
          <div style={{ flex: '1 1 420px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                backgroundColor: '#F5EBE6',
                color: '#D96B43',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}
            >
              <Flame size={13} />
              <span>Included Companion · /dropbox</span>
            </div>
            <h2
              id="dropbox-companion-heading"
              style={{
                fontSize: 'clamp(20px, 3vw, 28px)',
                fontWeight: 800,
                letterSpacing: '-0.5px',
                color: '#141518',
                marginBottom: '8px',
              }}
            >
              Need to Send Files, Links &amp; Text Without Logging In?
            </h2>
            <p style={{ fontSize: '14px', color: '#57534E', margin: 0 }}>
              Open SecureBox Dropbox on a separate <strong>/dropbox</strong> page to transfer
              photos, videos, PDFs, links, and encrypted notes using a custom numeric pickup code
              — featuring AES-256-GCM encryption, burn-after-retrieval, and 7-day auto-delete.
            </p>
          </div>

          <a
            href="/dropbox"
            onClick={handleOpenDropbox}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '13px 22px',
              borderRadius: '12px',
              backgroundColor: '#D96B43',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 6px 18px rgba(217, 107, 67, 0.28)',
              flexShrink: 0,
            }}
          >
            <UploadCloud size={17} />
            <span>Open SecureBox Dropbox</span>
            <ArrowRight size={15} />
          </a>
        </div>
      </section>

      {/* ─── Frequently Asked Questions (Matches JSON-LD FAQPage Schema) ────────── */}
      <section
        aria-labelledby="securebox-faq-heading"
        style={{
          padding: '52px 20px',
          backgroundColor: '#FAF9F6',
        }}
      >
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#D96B43',
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
              }}
            >
              FAQ
            </span>
            <h2
              id="securebox-faq-heading"
              style={{
                fontSize: 'clamp(22px, 3.2vw, 32px)',
                fontWeight: 800,
                letterSpacing: '-0.6px',
                marginTop: '6px',
                color: '#141518',
              }}
            >
              Frequently Asked Questions About SecureBox
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {SECUREBOX_FAQS.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={faq.question}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E7E5E4',
                    borderRadius: '12px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%',
                      padding: '16px 18px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#141518',
                      fontSize: '15px',
                      fontWeight: 700,
                    }}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      size={18}
                      color="#78716C"
                      style={{
                        flexShrink: 0,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        padding: '0 18px 16px',
                        fontSize: '14px',
                        color: '#57534E',
                        lineHeight: 1.6,
                      }}
                    >
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      </main>

      <footer
        style={{
          padding: '36px 20px',
          backgroundColor: '#FAF9F6',
          borderTop: '1px solid #E7E5E4',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BrickWallPeeker width={28} height={22} />
            <span
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '12px',
                color: '#141518',
              }}
            >
              SECURE<span style={{ color: '#D96B43' }}>BOX</span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleLaunch}
              style={{
                background: 'none',
                border: 'none',
                color: '#57534E',
                fontSize: '12px',
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
                fontSize: '12px',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Download APK (54 MB)
            </a>
            <span style={{ color: '#A8A29E' }}>•</span>
            <span style={{ color: '#78716C', fontSize: '12px' }}>
              Zero-Knowledge AES-GCM-256 Architecture
            </span>
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '4px' }}>
            <a
              href="/dropbox"
              onClick={handleOpenDropbox}
              style={{ color: '#D96B43', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}
            >
              SecureBox Dropbox (/dropbox)
            </a>
            <a
              href="/Securebox"
              style={{ color: '#57534E', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}
            >
              SecureBox Vault Overview
            </a>
          </div>
          <div style={{ fontSize: '11px', color: '#A8A29E', marginTop: '6px' }}>
            &copy; 2026 SecureBox. All rights reserved. Zero server logs, zero message retention.
          </div>
        </div>
      </footer>
    </div>
  );
};
