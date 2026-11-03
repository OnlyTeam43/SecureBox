// client/src/components/RoomHub.tsx
import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { RoomMetadata } from '../types';
import { Plus, Gamepad2, Trash2, ArrowRight } from 'lucide-react';

interface RoomHubProps {
  savedRooms: RoomMetadata[];
  onCreateRoom: (handle: string, pin: string) => void;
  onEnterRoom: (room: RoomMetadata) => void;
  onDeleteRoom: (roomId: string) => void;
  onPlayGame: () => void;
}

export const RoomHub: React.FC<RoomHubProps> = ({
  savedRooms,
  onCreateRoom,
  onEnterRoom,
  onDeleteRoom,
  onPlayGame,
}) => {
  const [handle, setHandle] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) {
      alert('Please enter your display name / handle.');
      return;
    }
    if (pin.trim().length < 4) {
      alert('Please enter a PIN of at least 4 digits.');
      return;
    }
    setIsSubmitting(true);
    onCreateRoom(handle.trim(), pin.trim());
    setIsSubmitting(false);
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
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              Encrypted rooms & local inventory
            </span>
          </div>

          <button
            onClick={onPlayGame}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 9999,
              backgroundColor: Colors.bg.secondary,
              border: `1px solid ${Colors.borderStrong}`,
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
            Generate a private room link. When your partner opens it, the link is locked to you two.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: Colors.text.secondary, marginBottom: 6 }}>
                YOUR DISPLAY HANDLE
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={20}
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: Colors.bg.primary,
                  border: `1px solid ${Colors.borderStrong}`,
                  padding: '0 14px',
                  fontSize: 14,
                  color: Colors.text.primary,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: Colors.text.secondary, marginBottom: 6 }}>
                SHARED ROOM SECRET PIN (4 DIGITS)
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                maxLength={6}
                inputMode="numeric"
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: Colors.bg.primary,
                  border: `1px solid ${Colors.borderStrong}`,
                  padding: '0 14px',
                  fontSize: 14,
                  color: Colors.text.primary,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
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
          <h2 style={{ fontSize: 16, fontWeight: 600, color: Colors.text.primary, marginBottom: 4 }}>
            Saved Rooms
          </h2>
          <p style={{ fontSize: 13, color: Colors.text.secondary, marginBottom: 14 }}>
            Stored locally in your browser only. Zero server history.
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
                    padding: '12px 14px',
                    borderRadius: 12,
                    backgroundColor: Colors.bg.secondary,
                    border: `1px solid ${Colors.border}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: Colors.text.primary }}>
                      💬 {room.partnerHandle || 'Partner (Invite sent)'}
                    </div>
                    <div style={{ fontSize: 11, color: Colors.text.placeholder, marginTop: 2 }}>
                      Room: {room.roomId.slice(0, 10)}... • As @{room.myHandle}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => onEnterRoom(room)}
                      style={{
                        padding: '6px 12px',
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
                      onClick={() => {
                        if (confirm('Delete this room and its local history?')) {
                          onDeleteRoom(room.roomId);
                        }
                      }}
                      style={{
                        padding: 6,
                        borderRadius: 8,
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: Colors.text.placeholder,
                        cursor: 'pointer',
                      }}
                      title="Delete"
                    >
                      <Trash2 size={15} />
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
