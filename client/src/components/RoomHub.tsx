// client/src/components/RoomHub.tsx
import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { RoomMetadata } from '../types';
import {
  Plus,
  Gamepad2,
  Trash2,
  ArrowRight,
  Eye,
  EyeOff,
  Copy,
  Check,
  Calendar,
  MessageSquare,
  UploadCloud,
} from 'lucide-react';

interface RoomHubProps {
  savedRooms: RoomMetadata[];
  onCreateRoom: (handle: string, pin: string) => void;
  onEnterRoom: (room: RoomMetadata) => void;
  onDeleteRoom: (roomId: string) => void;
  onPlayGame: () => void;
  onOpenQuickDrop?: () => void;
}

export const RoomHub: React.FC<RoomHubProps> = ({
  savedRooms,
  onCreateRoom,
  onEnterRoom,
  onDeleteRoom,
  onPlayGame,
  onOpenQuickDrop,
}) => {
  const [handle, setHandle] = useState(() => {
    return localStorage.getItem('securebox_user_handle') || '';
  });
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [handleError, setHandleError] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdPin, setCreatedPin] = useState<string | null>(null);
  const [pinCopied, setPinCopied] = useState(false);
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

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 4
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    if (pinError) setPinError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!handle.trim()) {
      setHandleError('Please enter your display handle.');
      valid = false;
    } else {
      setHandleError('');
    }

    if (!/^\d{4}$/.test(pin)) {
      setPinError('Room Secret PIN must be exactly 4 digits (e.g. 1234).');
      valid = false;
    } else {
      setPinError('');
    }

    if (!valid) return;

    setIsSubmitting(true);
    setCreatedPin(pin);
    const cleanHandle = handle.replace(/^@+/, '').trim(); localStorage.setItem('securebox_user_handle', cleanHandle); onCreateRoom(cleanHandle, pin);
    setIsSubmitting(false);
  };

  const handleCopyPin = () => {
    if (createdPin) {
      navigator.clipboard.writeText(createdPin).catch(() => {});
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2000);
    }
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
      padding: '24px 16px 40px',
    }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
        }}>
          <div>
            <h1 style={{
              fontSize: 22,
              fontWeight: 600,
              color: Colors.text.primary,
              letterSpacing: '-0.3px',
              margin: 0,
            }}>
              SecureBox Hub
            </h1>
            <span style={{ fontSize: 13, color: Colors.text.secondary }}>
              Encrypted rooms &amp; local inventory
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onOpenQuickDrop && (
              <button
                onClick={onOpenQuickDrop}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 9999,
                  backgroundColor: 'rgba(217, 119, 87, 0.12)',
                  border: '1px solid ' + Colors.accent.primary,
                  color: Colors.accent.primary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="QuickDrop - Anonymous Cross-Device Media and Document Transfer"
              >
                <UploadCloud size={16} />
                <span>QuickDrop</span>
              </button>
            )}
            <button
              onClick={onPlayGame}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 9999,
                backgroundColor: Colors.bg.secondary,
                border: '1px solid ' + Colors.borderStrong,
                color: Colors.text.primary,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Gamepad2 size={16} color={Colors.accent.primary} />
              <span>Play Game</span>
            </button>
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
            Generate a private encrypted link. Share the link <strong>and</strong> the 4-digit PIN with your partner.
          </p>

          {/* PIN Created Banner */}
          {createdPin && (
            <div style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 10,
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 2, letterSpacing: '0.05em' }}>
                  ROOM SECRET PIN — SHARE WITH PARTNER
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: Colors.text.primary, letterSpacing: '0.3em' }}>
                  {createdPin}
                </div>
                <div style={{ fontSize: 11, color: Colors.text.secondary, marginTop: 2 }}>
                  Your partner needs this to join. Copy it now.
                </div>
              </div>
              <button
                onClick={handleCopyPin}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: pinCopied ? '#16a34a' : Colors.accent.primary,
                  border: 'none',
                  color: '#FFF',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                {pinCopied ? <Check size={14} /> : <Copy size={14} />}
                {pinCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: Colors.text.secondary, marginBottom: 6 }}>
                YOUR DISPLAY HANDLE
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => { const cleaned = e.target.value.replace(/^@+/, '').slice(0, 20); setHandle(cleaned); localStorage.setItem('securebox_user_handle', cleaned); if (handleError) setHandleError(''); }}
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
                  color: Colors.text.primary,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {handleError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{handleError}</div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: Colors.text.secondary, marginBottom: 6 }}>
                4-DIGIT ROOM SECRET PIN &nbsp;
                <span style={{ fontWeight: 400, color: Colors.text.placeholder }}>(share with partner — different from your Hub Password)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={handlePinChange}
                  placeholder="••••"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="\d{4}"
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: Colors.bg.primary,
                    border: `1px solid ${pinError ? '#ef4444' : Colors.borderStrong}`,
                    padding: '0 44px 0 14px',
                    fontSize: 20,
                    letterSpacing: '0.3em',
                    color: Colors.text.primary,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: Colors.text.secondary,
                    display: 'flex',
                    padding: 2,
                  }}
                  tabIndex={-1}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pinError && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{pinError}</div>
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
            Encrypted locally in your browser. Complete timestamp &amp; isolated history.
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
