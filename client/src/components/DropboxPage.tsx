// client/src/components/DropboxPage.tsx
// Dedicated SEO-optimized /dropbox page housing QuickDrop (zero-login encrypted file, link & text shuttle)

import React, { useState } from 'react';
import {
  UploadCloud,
  ShieldCheck,
  Flame,
  Clock,
  Lock,
  Gamepad2,
  Download,
  KeyRound,
  Link2,
  Laptop,
  ArrowRight,
  ChevronDown,
  FileText,
  Sparkles,
  PanelRight,
  CheckCircle2,
} from 'lucide-react';
import { QuickDropPanel } from './QuickDropModal';
import { BrickWallPeeker } from './BrickWallPeeker';
import { DROPBOX_FAQS } from '../utils/seo';

interface DropboxPageProps {
  initialCode?: string;
  initialTab?: 'upload' | 'retrieve';
  onLaunchApp?: () => void;
  onOpenSecureboxPage?: () => void;
}

export const DropboxPage: React.FC<DropboxPageProps> = ({
  initialCode = '',
  initialTab = 'upload',
  onLaunchApp,
  onOpenSecureboxPage,
}) => {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

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
            flexWrap: 'wrap',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href="#install-extension"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 11px',
                borderRadius: '8px',
                backgroundColor: '#F5EBE6',
                color: '#D96B43',
                border: '1px solid #F0CFC2',
                fontSize: '11px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <PanelRight size={13} />
              <span>Chrome Extension</span>
            </a>

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
              <span>APK</span>
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
        </nav>
      </header>

      <main>
        {/* ─── Hero + Embedded Interactive Dropbox Tool ─────────────────────── */}
        <section
          style={{
            padding: '36px 16px 48px',
            maxWidth: '1080px',
            margin: '0 auto',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 28px' }}>
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
                marginBottom: '14px',
                textTransform: 'uppercase',
              }}
            >
              <UploadCloud size={14} />
              <span>Browser Encrypted QuickDrop · Zero Sign-In Required</span>
            </div>

            <h1
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

        {/* ─── Trust Badges / Key Capabilities ──────────────────────────────── */}
        <section
          aria-label="Key Security Guarantees"
          style={{
            padding: '16px 20px 44px',
            maxWidth: '1080px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
              gap: '14px',
            }}
          >
            {[
              {
                icon: Lock,
                title: 'AES-256-GCM In Browser',
                desc: 'Files and links are encrypted locally with PBKDF2 (100,000 iterations) before upload.',
              },
              {
                icon: KeyRound,
                title: 'Custom Numeric Pickup Code',
                desc: 'Pick any memorable code or generate a random 6-digit PIN—zero emails or passwords.',
              },
              {
                icon: Flame,
                title: 'Burn After Retrieval',
                desc: 'Permanently delete files and notes from cloud storage the second they are picked up.',
              },
              {
                icon: Clock,
                title: '7-Day Hard Auto-Delete',
                desc: 'Every unburned bundle self-destructs after 7 days with zero permanent cloud archive.',
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1px solid #E7E5E4',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
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
                  <item.icon size={18} />
                </div>
                <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', color: '#141518' }}>
                  {item.title}
                </h2>
                <p style={{ fontSize: '13px', color: '#57534E', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Install Chrome Extension Section ─────────────────────────────── */}
        <section
          id="install-extension"
          aria-labelledby="quickdrop-extension-heading"
          style={{
            padding: '12px 20px 52px',
            maxWidth: '1080px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E7E5E4',
              borderRadius: '20px',
              padding: 'clamp(22px, 3.6vw, 34px)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: '24px',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 11px',
                  borderRadius: '999px',
                  backgroundColor: '#F5EBE6',
                  color: '#D96B43',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                }}
              >
                <PanelRight size={13} />
                <span>Chrome Extension · Manifest V3</span>
              </div>

              <h2
                id="quickdrop-extension-heading"
                style={{
                  fontSize: 'clamp(22px, 3vw, 30px)',
                  fontWeight: 800,
                  letterSpacing: '-0.6px',
                  color: '#141518',
                  marginBottom: '10px',
                  lineHeight: 1.2,
                }}
              >
                Install QuickDrop Chrome Extension
              </h2>

              <p style={{ fontSize: '14px', color: '#57534E', marginBottom: '16px' }}>
                Send active tab links, right-click URLs, highlighted text, pasted screenshots
                (<code>Ctrl+V</code>), or batch files straight from your browser toolbar or Side
                Panel — 100% synced with <strong>/dropbox</strong>.
              </p>

              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '13px',
                  color: '#44403C',
                }}
              >
                {[
                  'Toolbar Popup & Chrome Side Panel (keeps file picker open)',
                  'Right-click context menu: Send Link, Selected Text, or Page URL',
                  '1-click "+ Tab URL" button & zero-knowledge AES-256-GCM encryption',
                ].map((point) => (
                  <li
                    key={point}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}
                  >
                    <CheckCircle2
                      size={16}
                      color="#D96B43"
                      style={{ flexShrink: 0, marginTop: '2px' }}
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <a
                  href="/downloads/securebox-quickdrop-extension.zip"
                  download="securebox-quickdrop-extension.zip"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backgroundColor: '#D96B43',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 6px 16px rgba(217, 107, 67, 0.25)',
                  }}
                >
                  <Download size={17} />
                  <span>Download Extension (.zip)</span>
                </a>
                <span style={{ fontSize: '12px', color: '#78716C', fontWeight: 600 }}>
                  v1.0.0 · Chrome, Edge, Brave &amp; Arc
                </span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#FAF9F6',
                border: '1px solid #E7E5E4',
                borderRadius: '14px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#141518',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                }}
              >
                Quick Install Guide (60 Seconds)
              </div>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '13px',
                  color: '#57534E',
                }}
              >
                <li>
                  Click <strong>Download Extension (.zip)</strong> and extract it into a folder on
                  your computer.
                </li>
                <li>
                  Open <code>chrome://extensions</code> in Chrome (or{' '}
                  <code>brave://extensions</code> / <code>edge://extensions</code>).
                </li>
                <li>
                  Toggle on <strong>Developer mode</strong> in the top-right corner.
                </li>
                <li>
                  Click <strong>Load unpacked</strong> and select the extracted folder containing{' '}
                  <code>manifest.json</code>, then pin <strong>SecureBox QuickDrop</strong> to your
                  toolbar.
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* ─── How It Works Section ─────────────────────────────────────────── */}
        <section
          aria-labelledby="dropbox-how-it-works"
          style={{
            padding: '52px 20px',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E7E5E4',
            borderBottom: '1px solid #E7E5E4',
          }}
        >
          <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 36px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#D96B43',
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                }}
              >
                HOW IT WORKS
              </span>
              <h2
                id="dropbox-how-it-works"
                style={{
                  fontSize: 'clamp(22px, 3.4vw, 34px)',
                  fontWeight: 800,
                  letterSpacing: '-0.6px',
                  marginTop: '6px',
                  marginBottom: '10px',
                  color: '#141518',
                }}
              >
                Cross-Device File &amp; Link Handoff in 3 Steps
              </h2>
              <p style={{ fontSize: '15px', color: '#57534E', margin: 0 }}>
                Designed for print shops, college lab PCs, work computers, and quick phone-to-laptop transfers where you never want to expose personal WhatsApp or email sessions.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '18px',
              }}
            >
              {[
                {
                  step: 'STEP 01',
                  title: 'Drop Media, Docs, Links or Text',
                  desc: 'Select multiple images, videos, PDFs, or Office files (up to 15 MB per file / 35 MB bundle) and optionally paste URLs or encrypted text notes up to 100,000 characters.',
                },
                {
                  step: 'STEP 02',
                  title: 'Lock With Your Numeric Code',
                  desc: 'Type your own numeric code or click Random. Your browser derives an AES-256-GCM key locally and encrypts filenames, file bytes, and text before upload.',
                },
                {
                  step: 'STEP 03',
                  title: 'Search, Open & Burn on Any Device',
                  desc: 'Open thesecurebox.vercel.app/dropbox on the target computer, enter your code under Search & Retrieve, open links in 1 tap or download files, and burn the cloud copy.',
                },
              ].map((s) => (
                <article
                  key={s.step}
                  style={{
                    backgroundColor: '#FAF9F6',
                    border: '1px solid #E7E5E4',
                    borderRadius: '16px',
                    padding: '24px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#D96B43',
                      letterSpacing: '0.8px',
                      marginBottom: '8px',
                    }}
                  >
                    {s.step}
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px', color: '#141518' }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: '13.5px', color: '#57534E', margin: 0 }}>{s.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Use Cases & Supported Payloads ───────────────────────────────── */}
        <section
          aria-labelledby="dropbox-use-cases"
          style={{ padding: '52px 20px', maxWidth: '1080px', margin: '0 auto' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2
              id="dropbox-use-cases"
              style={{
                fontSize: 'clamp(22px, 3.2vw, 32px)',
                fontWeight: 800,
                letterSpacing: '-0.6px',
                color: '#141518',
                marginBottom: '8px',
              }}
            >
              Built for Public Computers, Phones &amp; Private Links
            </h2>
            <p style={{ fontSize: '15px', color: '#57534E', maxWidth: '660px', margin: '0 auto' }}>
              Everything works inside the browser with zero installs or sign-ups.
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
                backgroundColor: '#FFFFFF',
                border: '1px solid #E7E5E4',
                borderRadius: '16px',
                padding: '22px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <Laptop size={20} color="#D96B43" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Print Shops &amp; Shared Computers
                </h3>
              </div>
              <p style={{ fontSize: '13.5px', color: '#57534E', margin: 0 }}>
                Need to print a PDF, ID card photo, or assignment on an unfamiliar Windows/Mac PC?
                Upload from your phone to <strong>/dropbox</strong>, type your numeric pickup code on
                the shop computer, download once, and auto-burn immediately.
              </p>
            </article>

            <article
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E7E5E4',
                borderRadius: '16px',
                padding: '22px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <Link2 size={20} color="#D96B43" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Clickable URLs &amp; Encrypted Notes
                </h3>
              </div>
              <p style={{ fontSize: '13.5px', color: '#57534E', margin: 0 }}>
                Send long URLs, code snippets, or travel checklists alongside media or by themselves.
                SecureBox QuickDrop automatically extracts <code>http://</code> and{' '}
                <code>https://</code> links into 1-tap Open &amp; Copy cards plus optional{' '}
                <code>.txt</code> export.
              </p>
            </article>

            <article
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E7E5E4',
                borderRadius: '16px',
                padding: '22px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <FileText size={20} color="#D96B43" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Multi-File Batch Encryption
                </h3>
              </div>
              <p style={{ fontSize: '13.5px', color: '#57534E', margin: 0 }}>
                Select multiple images, videos, PDFs, Word documents, spreadsheets, or ZIP archives
                together. Each file blob and metadata bundle is sealed with randomized IVs inside
                your browser using WebCrypto.
              </p>
            </article>
          </div>
        </section>

        {/* ─── Frequently Asked Questions (Matches JSON-LD FAQPage Schema) ──── */}
        <section
          aria-labelledby="dropbox-faq-heading"
          style={{
            padding: '52px 20px',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E7E5E4',
            borderBottom: '1px solid #E7E5E4',
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
                id="dropbox-faq-heading"
                style={{
                  fontSize: 'clamp(22px, 3.2vw, 32px)',
                  fontWeight: 800,
                  letterSpacing: '-0.6px',
                  marginTop: '6px',
                  color: '#141518',
                }}
              >
                Frequently Asked Questions About SecureBox QuickDrop
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {DROPBOX_FAQS.map((faq, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div
                    key={faq.question}
                    style={{
                      backgroundColor: '#FAF9F6',
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

        {/* ─── SecureBox Vault Cross-Link CTA Banner ────────────────────────── */}
        <section
          aria-labelledby="securebox-crosslink"
          style={{
            padding: '52px 20px',
            backgroundColor: '#141518',
            color: '#FFFFFF',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '999px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#D96B43',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                marginBottom: '14px',
              }}
            >
              <Sparkles size={13} />
              <span>Need Full Private Encrypted Chat Rooms?</span>
            </div>

            <h2
              id="securebox-crosslink"
              style={{
                fontSize: 'clamp(22px, 3.6vw, 34px)',
                fontWeight: 800,
                letterSpacing: '-0.6px',
                marginBottom: '12px',
              }}
            >
              Explore SecureBox Disguised Vault &amp; Android APK
            </h2>

            <p style={{ fontSize: '15px', color: '#A8A29E', marginBottom: '24px' }}>
              Hidden inside an authentic playable Brick Smash arcade game. End-to-end encrypted
              24-hour chat rooms, zero logs, and direct 54 MB Android APK installer.
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <a
                href="/Securebox"
                onClick={handleNavigateSecurebox}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 22px',
                  borderRadius: '12px',
                  backgroundColor: '#D96B43',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                <ShieldCheck size={17} />
                <span>Explore SecureBox Features</span>
                <ArrowRight size={15} />
              </a>

              <a
                href="/securebox.apk"
                download="SecureBox.apk"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 22px',
                  borderRadius: '12px',
                  backgroundColor: '#1E2024',
                  border: '1px solid #2E333D',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <Download size={17} />
                <span>Download SecureBox.apk (54 MB)</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: '32px 20px',
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
              Android APK (54 MB)
            </a>
          </nav>

          <div style={{ fontSize: '11px', color: '#A8A29E' }}>
            &copy; 2026 SecureBox QuickDrop. Client-side AES-256-GCM encryption · 7-day auto-delete.
          </div>
        </div>
      </footer>
    </div>
  );
};
