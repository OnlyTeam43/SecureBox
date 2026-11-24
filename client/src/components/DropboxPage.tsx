// client/src/components/DropboxPage.tsx
// Dedicated SEO-optimized /dropbox page housing QuickDrop (zero-login encrypted file, link & text shuttle)

import React, { useState } from 'react';
import {
  UploadCloud,
  ShieldCheck,
  Gamepad2,
  Download,
  Link2,
  Laptop,
  FileText,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { QuickDropPanel } from './QuickDropModal';
import { BrickWallPeeker } from './BrickWallPeeker';
import { BottomNavBar } from './BottomNavBar';

interface DropboxPageProps {
  initialCode?: string;
  initialTab?: 'upload' | 'retrieve';
  onLaunchApp?: () => void;
  onOpenSecureboxPage?: () => void;
  onOpenUserProfile?: () => void;
}

export const DropboxPage: React.FC<DropboxPageProps> = ({
  initialCode = '',
  initialTab = 'upload',
  onLaunchApp,
  onOpenSecureboxPage,
  onOpenUserProfile,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUsesOpen, setIsUsesOpen] = useState(false);

  const handleNavigateApp = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (onLaunchApp) {
      onLaunchApp();
    } else {
      window.history.pushState(null, '', '/');
      window.location.href = '/';
    }
  };

  const handleNavigateSecurebox = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (onOpenSecureboxPage) {
      onOpenSecureboxPage();
    } else {
      window.history.pushState(null, '', '/Securebox');
      window.location.href = '/Securebox';
    }
  };

  return (
    <div
      id="dropbox-scroll-container"
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
      {/* ─── Sticky Header Navigation ─────────────────────────────────────── */}
      <header
        className="dropbox-header"
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
        <nav
          aria-label="Primary navigation"
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            position: 'relative',
          }}
        >
          <a
            href="/Securebox"
            onClick={handleNavigateSecurebox}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              minWidth: 0,
            }}
            title="SecureBox Encrypted Vault & Android APK"
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
              <div style={{ fontSize: '10px', color: '#78716C', fontWeight: 500 }}>
                QuickDrop · Zero-Login Shuttle
              </div>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="dropbox-desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href="/Securebox"
              onClick={handleNavigateSecurebox}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 11px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                color: '#141518',
                border: '1px solid #E7E5E4',
                fontSize: '11px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ShieldCheck size={13} color="#D96B43" />
              <span>SecureBox Vault</span>
            </a>

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
              }}
            >
              <Download size={12} />
              <span>APK (2.9 MB)</span>
            </a>

            <a
              href="/"
              onClick={handleNavigateApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 11px',
                borderRadius: '8px',
                backgroundColor: '#D96B43',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Gamepad2 size={13} />
              <span>Open App</span>
            </a>
          </div>

          {/* Mobile Navigation */}
          <div className="dropbox-mobile-nav" style={{ display: 'none', alignItems: 'center', gap: '6px' }}>
            <a
              href="/"
              onClick={handleNavigateApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: '#D96B43',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Gamepad2 size={13} />
              <span>App</span>
            </a>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: isMobileMenuOpen ? '#EFECE6' : '#FFFFFF',
                border: '1px solid #E7E5E4',
                color: '#141518',
                cursor: 'pointer',
              }}
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            {isMobileMenuOpen && (
              <>
                <div
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 998,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 250,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    border: '1px solid #E7E5E4',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
                    padding: 8,
                    zIndex: 999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <a
                    href="/securebox.apk"
                    download="SecureBox.apk"
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      backgroundColor: 'rgba(217, 107, 67, 0.08)',
                      border: '1px solid rgba(217, 107, 67, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Download size={15} color="#D96B43" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#D96B43' }}>Download APK</span>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: '#D96B43' }}>2.9 MB</span>
                  </a>

                  <a
                    href="/Securebox"
                    onClick={(e) => {
                      setIsMobileMenuOpen(false);
                      handleNavigateSecurebox(e);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      color: '#141518',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <ShieldCheck size={15} color="#D96B43" />
                    <span>SecureBox Vault</span>
                  </a>

                  <a
                    href="/"
                    onClick={(e) => {
                      setIsMobileMenuOpen(false);
                      handleNavigateApp(e);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      color: '#141518',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <Gamepad2 size={15} color="#D96B43" />
                    <span>Play Brick Smash</span>
                  </a>
                </div>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        {/* ─── Hero + Embedded Interactive Dropbox Tool ─────────────────────── */}
        <section
          className="dropbox-hero-section"
          style={{
            padding: '36px 16px 48px',
            maxWidth: '1080px',
            margin: '0 auto',
          }}
        >
          <div className="dropbox-hero-text" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 28px' }}>
            <div
              className="dropbox-hero-badge"
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
                marginBottom: '14px',
                textTransform: 'uppercase',
              }}
            >
              <UploadCloud size={14} />
              <span>Browser Encrypted QuickDrop · Zero Sign-In Required</span>
            </div>

            <h1
              className="dropbox-hero-title"
              style={{
                fontSize: 'clamp(26px, 4.4vw, 44px)',
                fontWeight: 800,
                letterSpacing: '-1px',
                lineHeight: 1.15,
                color: '#141518',
                marginBottom: '14px',
              }}
            >
              Send Files, Links &amp; Text Between Devices{' '}
              <span style={{ color: '#D96B43' }}>Without Logging In.</span>
            </h1>

            <p
              className="dropbox-hero-desc"
              style={{
                fontSize: 'clamp(14px, 1.9vw, 17px)',
                color: '#57534E',
                maxWidth: '670px',
                margin: '0 auto',
              }}
            >
              Upload photos, videos, PDFs, links, or notes in your browser and protect them with
              your own numeric pickup code. Client-side AES-256-GCM encryption, optional instant
              burn-after-retrieval, and strict 7-day automatic deletion.
            </p>
          </div>

          {/* Interactive Dropbox Tool Card */}
          <QuickDropPanel
            isOpen
            embedded
            initialCode={initialCode}
            initialTab={initialTab}
          />
        </section>

        {/* ─── Uses Dropdown: QuickDrop System Built for Public & Private Use ─── */}
        <section
          aria-label="Uses"
          style={{ padding: '8px 16px 28px', maxWidth: '1080px', margin: '0 auto' }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E7E5E4',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Dropdown Toggle Button */}
            <button
              onClick={() => setIsUsesOpen((prev) => !prev)}
              aria-expanded={isUsesOpen}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                backgroundColor: isUsesOpen ? '#FAF9F6' : '#FFFFFF',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: isUsesOpen ? '1px solid #E7E5E4' : 'none',
                transition: 'background-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: "'Space Grotesk', -apple-system, sans-serif",
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#141518',
                    letterSpacing: '-0.3px',
                  }}
                >
                  Uses
                </span>
                <span style={{ fontSize: '12px', color: '#78716C', fontWeight: 500 }}>
                  · Built for Public Computers, Phones &amp; Private Links
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: isUsesOpen ? '#D96B43' : '#78716C',
                  fontSize: '12px',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                <span>{isUsesOpen ? 'Hide' : 'Show'}</span>
                <ChevronDown
                  size={16}
                  style={{
                    transform: isUsesOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </div>
            </button>

            {/* Dropdown Content */}
            {isUsesOpen && (
              <div style={{ padding: '20px 18px 24px', backgroundColor: '#FFFFFF' }}>
                <div style={{ marginBottom: '20px' }}>
                  <h3
                    style={{
                      fontSize: '17px',
                      fontWeight: 700,
                      color: '#141518',
                      marginBottom: '6px',
                    }}
                  >
                    Built for Public Computers, Phones &amp; Private Links
                  </h3>
                  <p style={{ fontSize: '13.5px', color: '#57534E', margin: 0, lineHeight: 1.5 }}>
                    Everything works inside the browser with zero installs or sign-ups. Transfer photos,
                    videos, documents, or secret notes between public terminals, work laptops, and mobile devices
                    without exposing your personal accounts.
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <article
                    style={{
                      backgroundColor: '#FAF9F6',
                      border: '1px solid #E7E5E4',
                      borderRadius: '12px',
                      padding: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <Laptop size={18} color="#D96B43" />
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                        Print Shops &amp; Shared Computers
                      </h4>
                    </div>
                    <p style={{ fontSize: '13px', color: '#57534E', margin: 0, lineHeight: 1.5 }}>
                      Need to print a PDF, ID card photo, or assignment on an unfamiliar Windows/Mac PC?
                      Upload from your phone to <strong>/dropbox</strong>, type your numeric pickup code on
                      the shop computer, download once, and auto-burn immediately.
                    </p>
                  </article>

                  <article
                    style={{
                      backgroundColor: '#FAF9F6',
                      border: '1px solid #E7E5E4',
                      borderRadius: '12px',
                      padding: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <Link2 size={18} color="#D96B43" />
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                        Clickable URLs &amp; Encrypted Notes
                      </h4>
                    </div>
                    <p style={{ fontSize: '13px', color: '#57534E', margin: 0, lineHeight: 1.5 }}>
                      Send long URLs, code snippets, or travel checklists alongside media or by themselves.
                      SecureBox QuickDrop automatically extracts <code>http://</code> and{' '}
                      <code>https://</code> links into 1-tap Open &amp; Copy cards plus optional{' '}
                      <code>.txt</code> export.
                    </p>
                  </article>

                  <article
                    style={{
                      backgroundColor: '#FAF9F6',
                      border: '1px solid #E7E5E4',
                      borderRadius: '12px',
                      padding: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <FileText size={18} color="#D96B43" />
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                        Multi-File Batch Encryption
                      </h4>
                    </div>
                    <p style={{ fontSize: '13px', color: '#57534E', margin: 0, lineHeight: 1.5 }}>
                      Select multiple images, videos, PDFs, Word documents, spreadsheets, or ZIP archives
                      together. Each file blob and metadata bundle is sealed with randomized IVs inside
                      your browser using WebCrypto.
                    </p>
                  </article>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: '32px 20px calc(74px + env(safe-area-inset-bottom, 0px))',
          backgroundColor: '#FAF9F6',
          borderTop: '1px solid #E7E5E4',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '1080px',
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
              SECURE<span style={{ color: '#D96B43' }}>BOX</span> QUICKDROP
            </span>
          </div>

          <nav
            aria-label="Footer links"
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              fontSize: '12px',
            }}
          >
            <a
              href="/Securebox"
              onClick={handleNavigateSecurebox}
              style={{ color: '#57534E', textDecoration: 'none', fontWeight: 600 }}
            >
              SecureBox Vault Overview
            </a>
            <a
              href="/dropbox"
              style={{ color: '#D96B43', textDecoration: 'none', fontWeight: 600 }}
            >
              QuickDrop (/dropbox)
            </a>
            <a
              href="/"
              onClick={handleNavigateApp}
              style={{ color: '#57534E', textDecoration: 'none', fontWeight: 600 }}
            >
              Brick Smash Disguise
            </a>
            <a
              href="/securebox.apk"
              download="SecureBox.apk"
              style={{ color: '#57534E', textDecoration: 'none', fontWeight: 600 }}
            >
              Android APK (2.9 MB)
            </a>
          </nav>

          <div style={{ fontSize: '11px', color: '#A8A29E' }}>
            &copy; 2026 SecureBox QuickDrop. Client-side AES-256-GCM encryption · 7-day auto-delete.
          </div>
        </div>
      </footer>

      {/* 3-Icon Mobile Bottom Navigation Bar (1st: Chat, 2nd: QuickDrop, 3rd: User - NO EMOJIS) */}
      <BottomNavBar
        activeTab="quickdrop"
        onTabChange={(tab) => {
          if (tab === 'chat') {
            if (onLaunchApp) onLaunchApp();
            else handleNavigateApp();
          } else if (tab === 'user') {
            if (onOpenUserProfile) {
              onOpenUserProfile();
            } else if (onLaunchApp) {
              onLaunchApp();
            } else {
              handleNavigateApp();
            }
          }
        }}
        maxWidth="100%"
      />
    </div>
  );
};
