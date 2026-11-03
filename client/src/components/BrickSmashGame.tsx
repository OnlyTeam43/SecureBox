// client/src/components/BrickSmashGame.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Colors, BrickRowColors } from '../theme/tokens';
import { Lock } from 'lucide-react';

interface BrickSmashGameProps {
  onUnlockClick: () => void;
}

export const BrickSmashGame: React.FC<BrickSmashGameProps> = ({ onUnlockClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('brick_smash_high_score') || '0', 10);
  });
  const [lives, setLives] = useState(3);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isVictory, setIsVictory] = useState(false);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      try {
        const AudioClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioClass) audioCtxRef.current = new AudioClass();
      } catch (_) {}
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  };

  const playTone = (freq: number, duration = 0.08, type: OscillatorType = 'sine') => {
    if (!audioCtxRef.current) return;
    try {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + duration);
    } catch (_) {}
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let currentScore = 0;
    let currentLives = 3;
    let currentLevel = 1;
    let gameOver = false;
    let victory = false;

    // Dimensions
    const dpr = window.devicePixelRatio || 1;
    const updateSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const w = Math.min(rect.width || 480, 560);
      const h = Math.min(rect.height || 640, 700);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      return { w, h };
    };

    let { w, h } = updateSize() || { w: 480, h: 640 };

    // Game objects
    const paddle = {
      x: (w - 90) / 2,
      y: h - 35,
      width: Math.max(76, Math.min(100, w * 0.22)),
      height: 12,
    };

    const ball = {
      x: w / 2,
      y: h - 48,
      radius: 6,
      dx: 4,
      dy: -4,
      speed: 4.8,
    };

    interface Brick {
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      border: string;
      pts: number;
      alive: boolean;
    }

    let bricks: Brick[] = [];
    const particles: Array<{ x: number; y: number; dx: number; dy: number; r: number; color: string; life: number }> = [];

    const initBricks = () => {
      const cols = Math.floor(Math.min(8, (w - 24) / 48));
      const brickWidth = Math.floor((w - 24 - (cols - 1) * 5) / cols);
      const brickHeight = 14;
      const startY = 65;
      bricks = [];

      for (let r = 0; r < Math.min(7, BrickRowColors.length); r++) {
        const rowColor = BrickRowColors[r];
        for (let c = 0; c < cols; c++) {
          bricks.push({
            x: 12 + c * (brickWidth + 5),
            y: startY + r * (brickHeight + 5),
            width: brickWidth,
            height: brickHeight,
            color: rowColor.color,
            border: rowColor.border,
            pts: rowColor.points,
            alive: true,
          });
        }
      }
    };

    const resetBall = () => {
      ball.x = paddle.x + paddle.width / 2;
      ball.y = paddle.y - 12;
      const angle = Math.PI / 4 + (Math.random() * Math.PI) / 2;
      ball.dx = Math.cos(angle) * (Math.random() > 0.5 ? ball.speed : -ball.speed);
      ball.dy = -Math.abs(Math.sin(angle) * ball.speed);
    };

    initBricks();
    resetBall();

    // Event handlers
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      initAudio();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      paddle.x = Math.max(0, Math.min(w - paddle.width, touchX - paddle.width / 2));
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      paddle.x = Math.max(0, Math.min(w - paddle.width, mouseX - paddle.width / 2));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      initAudio();
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        paddle.x = Math.max(0, paddle.x - 24);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        paddle.x = Math.min(w - paddle.width, paddle.x + 24);
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (gameOver || victory) {
          restartGame();
        }
      }
    };

    const restartGame = () => {
      currentScore = 0;
      currentLives = 3;
      currentLevel = 1;
      gameOver = false;
      victory = false;
      setScore(0);
      setLives(3);
      setIsGameOver(false);
      setIsVictory(false);
      initBricks();
      resetBall();
    };

    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', () => {
      initAudio();
      if (gameOver || victory) restartGame();
    });
    window.addEventListener('keydown', onKeyDown);

    // Game loop
    const loop = () => {
      if (!gameOver && !victory) {
        // Move ball
        ball.x += ball.dx;
        ball.y += ball.dy;

        // Side walls
        if (ball.x - ball.radius <= 0) {
          ball.x = ball.radius;
          ball.dx = Math.abs(ball.dx);
          playTone(380, 0.05, 'triangle');
        } else if (ball.x + ball.radius >= w) {
          ball.x = w - ball.radius;
          ball.dx = -Math.abs(ball.dx);
          playTone(380, 0.05, 'triangle');
        }

        // Top wall
        if (ball.y - ball.radius <= 44) {
          ball.y = 44 + ball.radius;
          ball.dy = Math.abs(ball.dy);
          playTone(380, 0.05, 'triangle');
        }

        // Paddle hit
        if (
          ball.y + ball.radius >= paddle.y &&
          ball.y - ball.radius <= paddle.y + paddle.height &&
          ball.x >= paddle.x - 2 &&
          ball.x <= paddle.x + paddle.width + 2
        ) {
          const hitRatio = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
          const maxAngle = (Math.PI / 180) * 60;
          const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
          ball.dx = speed * Math.sin(hitRatio * maxAngle);
          ball.dy = -Math.abs(speed * Math.cos(hitRatio * maxAngle));
          ball.y = paddle.y - ball.radius;
          playTone(440, 0.06, 'triangle');
        }

        // Brick collision
        let remaining = 0;
        for (const b of bricks) {
          if (!b.alive) continue;
          remaining++;

          if (
            ball.x + ball.radius >= b.x &&
            ball.x - ball.radius <= b.x + b.width &&
            ball.y + ball.radius >= b.y &&
            ball.y - ball.radius <= b.y + b.height
          ) {
            b.alive = false;
            ball.dy = -ball.dy;
            currentScore += b.pts;
            setScore(currentScore);

            const storedHigh = parseInt(localStorage.getItem('brick_smash_high_score') || '0', 10);
            if (currentScore > storedHigh) {
              setHighScore(currentScore);
              localStorage.setItem('brick_smash_high_score', currentScore.toString());
            }

            // Sparks
            for (let i = 0; i < 6; i++) {
              particles.push({
                x: b.x + b.width / 2,
                y: b.y + b.height / 2,
                dx: (Math.random() - 0.5) * 5,
                dy: (Math.random() - 0.5) * 5,
                r: Math.random() * 2 + 1,
                color: b.color,
                life: 1,
              });
            }

            playTone(480 + b.pts * 2, 0.05, 'sine');
            document.title = `Brick Smash | Score: ${currentScore}`;
            break;
          }
        }

        // Level victory
        if (remaining === 0) {
          currentLevel++;
          if (currentLevel > 4) {
            victory = true;
            setIsVictory(true);
          } else {
            initBricks();
            resetBall();
          }
        }

        // Fall out
        if (ball.y - ball.radius > h) {
          currentLives--;
          setLives(currentLives);
          playTone(180, 0.2, 'sawtooth');
          if (currentLives <= 0) {
            gameOver = true;
            setIsGameOver(true);
          } else {
            resetBall();
          }
        }

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.dx;
          p.y += p.dy;
          p.life -= 0.04;
          if (p.life <= 0) particles.splice(i, 1);
        }
      }

      // Render
      ctx.clearRect(0, 0, w, h);

      // Background - Claude Warm Palette Canvas
      ctx.fillStyle = '#FAF9F5';
      ctx.fillRect(0, 0, w, h);

      // Hairline Grid Lines
      ctx.strokeStyle = 'rgba(20, 20, 19, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 44);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // HUD Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, 44);
      ctx.strokeStyle = 'rgba(20, 20, 19, 0.08)';
      ctx.beginPath();
      ctx.moveTo(0, 44);
      ctx.lineTo(w, 44);
      ctx.stroke();

      // HUD Text
      ctx.fillStyle = '#141413';
      ctx.font = '500 13px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${currentScore}`, 16, 26);

      ctx.fillStyle = '#87867F';
      ctx.textAlign = 'center';
      ctx.fillText(`HIGH: ${highScore}`, w / 2, 26);

      ctx.textAlign = 'right';
      let hearts = '';
      for (let i = 0; i < currentLives; i++) hearts += '♥ ';
      ctx.fillStyle = Colors.accent.primary;
      ctx.font = '14px sans-serif';
      ctx.fillText(hearts.trim(), w - 16, 26);

      // Bricks
      for (const b of bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        (ctx as any).roundRect ? (ctx as any).roundRect(b.x, b.y, b.width, b.height, 4) : ctx.rect(b.x, b.y, b.width, b.height);
        ctx.fill();

        ctx.strokeStyle = b.border;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Particles
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Paddle - Claude Terracotta Accent
      ctx.fillStyle = Colors.accent.primary;
      ctx.beginPath();
      (ctx as any).roundRect
        ? (ctx as any).roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 6)
        : ctx.rect(paddle.x, paddle.y, paddle.width, paddle.height);
      ctx.fill();

      // Ball
      ctx.fillStyle = '#141413';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Overlays
      if (gameOver) {
        ctx.fillStyle = 'rgba(250, 249, 245, 0.9)';
        ctx.fillRect(0, 140, w, 140);
        ctx.textAlign = 'center';
        ctx.fillStyle = Colors.accent.primary;
        ctx.font = '600 24px -apple-system, sans-serif';
        ctx.fillText('GAME OVER', w / 2, 195);
        ctx.font = '400 13px -apple-system, sans-serif';
        ctx.fillStyle = '#5E5D59';
        ctx.fillText('Tap screen or press Space to play again', w / 2, 230);
      } else if (victory) {
        ctx.fillStyle = 'rgba(250, 249, 245, 0.9)';
        ctx.fillRect(0, 140, w, 140);
        ctx.textAlign = 'center';
        ctx.fillStyle = Colors.status.online;
        ctx.font = '600 24px -apple-system, sans-serif';
        ctx.fillText('VICTORY!', w / 2, 195);
        ctx.font = '400 13px -apple-system, sans-serif';
        ctx.fillStyle = '#5E5D59';
        ctx.fillText(`Final Score: ${currentScore}`, w / 2, 230);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: Colors.bg.primary,
    }}>
      {/* Top Header */}
      <div style={{
        width: '100%',
        maxWidth: 560,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: `1px solid ${Colors.border}`,
        backgroundColor: Colors.bg.elevated,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
          fontSize: 16,
          color: Colors.accent.primary,
          letterSpacing: '-0.3px',
          cursor: 'pointer',
        }}>
          <span>🧱 BRICK SMASH</span>
        </div>

        {/* Discreet PIN trigger */}
        <button
          onClick={onUnlockClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 8,
            backgroundColor: Colors.bg.secondary,
            border: `1px solid ${Colors.border}`,
            color: Colors.text.secondary,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          title="Security PIN"
        >
          <Lock size={13} color={Colors.text.secondary} />
          <span>PIN</span>
        </button>
      </div>

      {/* Canvas Wrapper */}
      <div style={{
        flex: 1,
        width: '100%',
        maxWidth: 560,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <canvas ref={canvasRef} style={{ cursor: 'pointer', touchAction: 'none' }} />
      </div>

      {/* Bottom Bar */}
      <div style={{
        width: '100%',
        maxWidth: 560,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 12,
        color: Colors.text.placeholder,
        borderTop: `1px solid ${Colors.border}`,
        backgroundColor: Colors.bg.elevated,
      }}>
        <span>Drag or arrow keys to move paddle</span>
        <span style={{ fontSize: 11, opacity: 0.8 }}>Claude Arcade</span>
      </div>
    </div>
  );
};
