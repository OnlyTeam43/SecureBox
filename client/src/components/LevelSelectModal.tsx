// client/src/components/LevelSelectModal.tsx
// Interactive 300-Level Selector and Animal Companion Drawer

import React, { useState } from 'react';
import { Colors } from '../theme/tokens';
import { TIERS } from './levelPatterns';
import { X, Lock, Check, Trophy } from 'lucide-react';

export type AnimalType = 'panda' | 'cat' | 'puppy';

interface LevelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLevel: number;
  maxUnlockedLevel: number;
  selectedCharacter: AnimalType;
  onSelectLevel: (lvl: number) => void;
  onSelectCharacter: (char: AnimalType) => void;
  highScore: number;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  isOpen,
  onClose,
  currentLevel,
  maxUnlockedLevel,
  selectedCharacter,
  onSelectLevel,
  onSelectCharacter,
  highScore,
}) => {


  // Determine initial tier tab based on current level
  const initialTierIndex = Math.min(
    Math.floor((currentLevel - 1) / 25),
    TIERS.length - 1
  );
  const [selectedTierIndex, setSelectedTierIndex] = useState(initialTierIndex);

  if (!isOpen) return null;

  const activeTier = TIERS[selectedTierIndex] || TIERS[0];
  const levelsInTier: number[] = [];
  for (let l = activeTier.start; l <= activeTier.end; l++) {
    levelsInTier.push(l);
  }

  const characters: Array<{ id: AnimalType; label: string; icon: string }> = [
    { id: 'panda', label: 'Panda', icon: '/characters/panda-idle.png' },
    { id: 'cat', label: 'Cat', icon: '/characters/cat-idle.png' },
    { id: 'puppy', label: 'Puppy', icon: '/characters/puppy-idle.png' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(20, 20, 19, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          backgroundColor: Colors.bg.elevated,
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0,0,0,0.22)',
          border: `1px solid ${Colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${Colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: Colors.bg.primary,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🧱</span>
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: Colors.text.primary,
                  margin: 0,
                  letterSpacing: '-0.2px',
                }}
              >
                Arcade Levels (300)
              </h2>
              <p
                style={{
                  fontSize: 12,
                  color: Colors.text.secondary,
                  margin: 0,
                }}
              >
                Playing Level {currentLevel} • {maxUnlockedLevel} Unlocked
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: Colors.text.secondary,
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Character Selector Section */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: `1px solid ${Colors.border}`,
            backgroundColor: Colors.bg.secondary,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: Colors.text.secondary,
              marginBottom: 8,
            }}
          >
            Ball Companion
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {characters.map((char) => {
              const isSelected = selectedCharacter === char.id;
              return (
                <button
                  key={char.id}
                  onClick={() => onSelectCharacter(char.id)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 10,
                    backgroundColor: isSelected ? '#FFFFFF' : Colors.bg.elevated,
                    border: `1.5px solid ${isSelected ? Colors.accent.primary : Colors.border}`,
                    boxShadow: isSelected ? '0 2px 6px rgba(217, 119, 87, 0.2)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <img
                    src={char.icon}
                    alt={char.label}
                    style={{ width: 24, height: 24, borderRadius: 12 }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? Colors.accent.primary : Colors.text.primary,
                    }}
                  >
                    {char.label}
                  </span>
                  {isSelected && <Check size={14} color={Colors.accent.primary} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tier Tabs (Horizontal Scrollable) */}
        <div
          style={{
            padding: '10px 16px',
            overflowX: 'auto',
            display: 'flex',
            gap: 6,
            borderBottom: `1px solid ${Colors.border}`,
            backgroundColor: Colors.bg.primary,
            scrollbarWidth: 'none',
          }}
        >
          {TIERS.map((tier) => {
            const isTierSelected = selectedTierIndex === tier.index;
            const isTierUnlocked = maxUnlockedLevel >= tier.start;
            return (
              <button
                key={tier.index}
                onClick={() => setSelectedTierIndex(tier.index)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: isTierSelected ? 600 : 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: isTierSelected
                    ? `1px solid ${Colors.accent.primary}`
                    : `1px solid ${Colors.border}`,
                  backgroundColor: isTierSelected
                    ? Colors.accent.primary
                    : Colors.bg.secondary,
                  color: isTierSelected
                    ? '#FFFFFF'
                    : isTierUnlocked
                    ? Colors.text.primary
                    : Colors.text.placeholder,
                  opacity: isTierUnlocked ? 1 : 0.6,
                  transition: 'all 0.15s ease',
                }}
              >
                {tier.label}
              </button>
            );
          })}
        </div>

        {/* Level Grid Section */}
        <div
          style={{
            padding: '16px',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: Colors.bg.primary,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: Colors.text.primary,
              }}
            >
              Tier {activeTier.index + 1}: {activeTier.name}
            </span>
            <span style={{ fontSize: 11, color: Colors.text.secondary }}>
              Levels {activeTier.start}–{activeTier.end}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 8,
            }}
          >
            {levelsInTier.map((lvl) => {
              const isUnlocked = lvl <= maxUnlockedLevel;
              const isCurrent = lvl === currentLevel;

              return (
                <button
                  key={lvl}
                  disabled={!isUnlocked}
                  onClick={() => {
                    onSelectLevel(lvl);
                    onClose();
                  }}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: isUnlocked ? 'pointer' : 'not-allowed',
                    border: isCurrent
                      ? `2px solid ${Colors.accent.primary}`
                      : isUnlocked
                      ? `1px solid ${Colors.border}`
                      : `1px solid rgba(0,0,0,0.06)`,
                    backgroundColor: isCurrent
                      ? 'rgba(217, 119, 87, 0.12)'
                      : isUnlocked
                      ? Colors.bg.elevated
                      : Colors.bg.secondary,
                    color: isCurrent
                      ? Colors.accent.primary
                      : isUnlocked
                      ? Colors.text.primary
                      : Colors.text.placeholder,
                    transition: 'all 0.12s ease',
                    boxShadow: isUnlocked ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                  }}
                >
                  {isUnlocked ? (
                    <>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: isCurrent ? 700 : 600,
                        }}
                      >
                        {lvl}
                      </span>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: Colors.accent.primary,
                            marginTop: 1,
                          }}
                        >
                          PLAYING
                        </span>
                      )}
                    </>
                  ) : (
                    <Lock size={15} color={Colors.text.placeholder} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Footer Info */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: `1px solid ${Colors.border}`,
            backgroundColor: Colors.bg.secondary,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: Colors.text.secondary,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={14} color={Colors.accent.primary} />
            <span>High Score: {highScore}</span>
          </div>
          <span>Max Unlocked: Level {maxUnlockedLevel}/300</span>
        </div>
      </div>
    </div>
  );
};
