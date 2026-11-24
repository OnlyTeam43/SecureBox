// client/src/components/RoomHub.tsx
import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { RoomMetadata } from '../types';
import {
  Plus,
  Gamepad2,
  Trash2,
  ArrowRight,
  Calendar,
  MessageSquare,
  UploadCloud,
  Smartphone,
  Download,
  Menu,
  X,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { BrickWallPeeker } from './BrickWallPeeker';
import { usePWAInstall } from '../utils/usePWAInstall';

interface RoomHubProps {
  savedRooms: RoomMetadata[];
  onCreateRoom: (handle: string) => void;
  onEnterRoom: (room: RoomMetadata) => void;
  onDeleteRoom: (roomId: string) => void;
  onPlayGame: () => void;
  onOpenQuickDrop?: () => void;
  onOpenSecureboxPage?: () => void;
}

export const RoomHub: React.FC<RoomHubProps> = ({
  savedRooms,
  onCreateRoom,
  onEnterRoom,
  onDeleteRoom,
  onPlayGame,
  onOpenQuickDrop,
  onOpenSecureboxPage,
}) => {
  const [handle, setHandle] = useState(() => {
    return localStorage.getItem('securebox_user_handle') || '';
  });
  const { canInstall, installApp } = usePWAInstall();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [handleError, setHandleError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const formatRoomDate = (timestamp?: number) => {
    if (!timestamp) return 'Created recently';
    const d = new Date(timestamp);
    const dateStr = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateStr} at ${timeStr}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = handle.replace(/^@+/, '').trim();
    if (!cleanHandle) {
      setHandleError('Please enter your display handle.');
      return;
    }
    setHandleError('');
    setIsSubmitting(true);
    localStorage.setItem('securebox_user_handle', cleanHandle);
    onCreateRoom(cleanHandle);
    setIsSubmitting(false);
  };

  const handleDeleteClick = (roomId: string) => {
    if (deleteConfirmId === roomId) {
      onDeleteRoom(roomId);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(roomId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      backgroundColor: Colors.bg.primary,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '16px 14px 76px',
    }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Header with Main Logo, Play Game Button, and Hamburger Menu */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 0',
          position: 'relative',
        }}>
          {/* Logo & Play Game Button on Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={onPlayGame} title="SecureBox">
              <BrickWallPeeker width={34} height={28} />
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
                  SECURE<span style={{ color: '#D97757' }}>BOX</span>
                </div>
                <div style={{ fontSize: '10px', color: '#78716C', fontWeight: 500, marginTop: 2 }}>
                  Private Vault · Encrypted Rooms
                </div>
              </div>
            </div>

            {/* Play Game Button placed right next to the logo */}
            <button
              onClick={onPlayGame}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 11px',
                borderRadius: 9999,
                backgroundColor: '#F5EBE6',
                border: '1px solid #F0CFC2',
                color: Colors.accent.primary,
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background-color 0.15s',
              }}
              title="Switch to Brick Smash Arcade Game Disguise"
            >
              <Gamepad2 size={13} color={Colors.accent.primary} />
              <span>Play Game</span>
            </button>
          </div>

          {/* Hamburger Menu Toggle on Right */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: isMenuOpen ? '#EFECE6' : Colors.bg.secondary,
                border: `1px solid ${Colors.borderStrong}`,
                color: Colors.text.primary,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
              aria-label="Navigation Menu"
            >
              {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Hamburger Dropdown Menu */}
            {isMenuOpen && (
              <>
                <div
                  onClick={() => setIsMenuOpen(false)}
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
                    width: 260,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    border: '1px solid #E7E5E4',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                    padding: 8,
                    zIndex: 999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {/* Item 1: Download Android APK (wrapped web) */}
                  <a
                    href="/securebox.apk"
                    download="SecureBox.apk"
                    onClick={() => setIsMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 10px',
                      borderRadius: 10,
                      textDecoration: 'none',
                      backgroundColor: 'rgba(217, 107, 67, 0.08)',
                      border: '1px solid rgba(217, 107, 67, 0.25)',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Download size={16} color={Colors.accent.primary} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: Colors.accent.primary }}>
                          Download Android APK
                        </div>
                        <div style={{ fontSize: 10.5, color: '#78716C' }}>
                          Standalone WebView Wrapper
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: Colors.accent.primary,
                      backgroundColor: '#FFFFFF',
                      padding: '2px 6px',
                      borderRadius: 6,
                    }}>
                      2.9 MB
                    </span>
                  </a>

                  {/* Item 2: QuickDrop */}
                  <a
                    href="/dropbox"
                    onClick={(e) => {
                      if (onOpenQuickDrop) {
                        e.preventDefault();
                        setIsMenuOpen(false);
                        onOpenQuickDrop();
                      } else {
                        setIsMenuOpen(false);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 10px',
                      borderRadius: 10,
                      textDecoration: 'none',
                      backgroundColor: 'transparent',
                      color: Colors.text.primary,
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <UploadCloud size={16} color={Colors.accent.primary} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: Colors.text.primary }}>
                          QuickDrop
                        </div>
                        <div style={{ fontSize: 10.5, color: '#78716C' }}>
                          Zero-Login File &amp; Text Shuttle
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} color="#A8A29E" />
                  </a>

                  {/* Item 3: Install App (PWA) */}
                  {canInstall && (
                    <div
                      onClick={() => {
                        setIsMenuOpen(false);
                        installApp();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 10px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        backgroundColor: '#E8F5E9',
                        border: '1px solid #A5D6A7',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Smartphone size={16} color="#2E7D32" />
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2E7D32' }}>
                            Install to Home Screen
                          </div>
                          <div style={{ fontSize: 10.5, color: '#388E3C' }}>
                            Progressive Web App (PWA)
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#2E7D32', textTransform: 'uppercase' }}>
                        Install
                      </span>
                    </div>
                  )}

                  {/* Item 4: About SecureBox */}
                  <a
                    href="/Securebox"
                    onClick={(e) => {
                      setIsMenuOpen(false);
                      if (onOpenSecureboxPage) {
                        e.preventDefault();
                        onOpenSecureboxPage();
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 10px',
                      borderRadius: 10,
                      textDecoration: 'none',
                      backgroundColor: 'transparent',
                      color: Colors.text.primary,
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <ShieldCheck size={16} color="#57534E" />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: Colors.text.primary }}>
                          About SecureBox
                        </div>
                        <div style={{ fontSize: 10.5, color: '#78716C' }}>
                          Architecture &amp; Zero-Logs Vault
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} color="#A8A29E" />
                  </a>

                  {/* Item 5: Play Disguise Game */}
                  <div
                    onClick={() => {
                      setIsMenuOpen(false);
                      onPlayGame();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 10px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      backgroundColor: 'transparent',
                      color: Colors.text.primary,
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Gamepad2 size={16} color={Colors.accent.primary} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: Colors.text.primary }}>
                          Play Brick Smash
                        </div>
                        <div style={{ fontSize: 10.5, color: '#78716C' }}>
                          Switch to Arcade Disguise
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} color="#A8A29E" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Create Room Card */}
        <div style={{
          backgroundColor: Colors.bg.elevated,
          border: `1px solid ${Colors.border}`,
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: Colors.text.primary, marginBottom: 4 }}>
            Create a Secret Room
          </h2>
          <p style={{ fontSize: 13, color: Colors.text.secondary, lineHeight: 1.45, marginBottom: 18 }}>
            Generate a private encrypted link. Your partner accesses directly using the link and their Hub Password.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: Colors.text.secondary, marginBottom: 6 }}>
                YOUR DISPLAY HANDLE
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/^@+/, '').slice(0, 20);
                  setHandle(cleaned);
                  localStorage.setItem('securebox_user_handle', cleaned);
                  if (handleError) setHandleError('');
                }}
                placeholder="e.g. Alex"
                maxLength={20}
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: Colors.bg.primary,
                  border: `1px solid ${handleError ? '#ef4444' : Colors.borderStrong}`,
                  padding: '0 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: Colors.text.primary,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {handleError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{handleError}</div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                height: 46,
                borderRadius: 10,
                backgroundColor: Colors.accent.primary,
                border: 'none',
                color: Colors.text.inverse,
                fontSize: 14,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                marginTop: 4,
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              <Plus size={16} />
              <span>Create Secret Room Link</span>
            </button>
          </form>
        </div>

        {/* Saved Rooms Inventory */}
        <div style={{
          backgroundColor: Colors.bg.elevated,
          border: `1px solid ${Colors.border}`,
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: Colors.text.primary, margin: 0 }}>
              Saved Rooms
            </h2>
            <span style={{ fontSize: 12, fontWeight: 600, color: Colors.accent.primary }}>
              {savedRooms.length} {savedRooms.length === 1 ? 'Room' : 'Rooms'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: Colors.text.secondary, marginBottom: 16 }}>
            Encrypted locally in your browser. Isolated history with zero server storage.
          </p>

          {savedRooms.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '24px 0',
              color: Colors.text.placeholder,
              fontSize: 13,
            }}>
              No active rooms yet. Create a room above to begin.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {savedRooms.map((room) => (
                <div
                  key={room.roomId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 14,
                    backgroundColor: Colors.bg.secondary,
                    border: `1px solid ${Colors.border}`,
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                      <MessageSquare size={15} color={Colors.accent.primary} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: Colors.text.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {room.partnerHandle ? `@${room.partnerHandle}` : 'Partner (Invite sent)'}
                      </span>
                      {!room.partnerHandle && (
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          backgroundColor: 'rgba(217, 119, 87, 0.12)',
                          color: Colors.accent.primary,
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}>
                          WAITING
                        </span>
                      )}
                    </div>

                    {/* Date and Time stamp of room creation */}
                    <div style={{
                      fontSize: 11,
                      color: Colors.text.secondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexWrap: 'wrap',
                    }}>
                      <Calendar size={11} color={Colors.text.placeholder} />
                      <span style={{ fontWeight: 500, color: Colors.text.primary }}>
                        {formatRoomDate(room.createdAt)}
                      </span>
                      <span style={{ color: Colors.text.placeholder }}>•</span>
                      <span style={{ color: Colors.text.placeholder }}>
                        As @{room.myHandle}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => onEnterRoom(room)}
                      style={{
                        padding: '7px 13px',
                        borderRadius: 8,
                        backgroundColor: Colors.accent.primary,
                        border: 'none',
                        color: '#FFF',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>Enter</span>
                      <ArrowRight size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(room.roomId)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        backgroundColor: deleteConfirmId === room.roomId ? '#fee2e2' : 'transparent',
                        border: deleteConfirmId === room.roomId ? '1px solid #fca5a5' : 'none',
                        color: deleteConfirmId === room.roomId ? '#dc2626' : Colors.text.placeholder,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        transition: 'all 0.15s',
                      }}
                      title={deleteConfirmId === room.roomId ? 'Click again to confirm delete' : 'Delete room'}
                    >
                      <Trash2 size={13} />
                      {deleteConfirmId === room.roomId && <span>Confirm?</span>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
