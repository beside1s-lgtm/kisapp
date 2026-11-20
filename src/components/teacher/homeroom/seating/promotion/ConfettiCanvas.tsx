'use client';

import React, { useEffect, useRef } from 'react';

interface ConfettiPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  opacity: number;
}

const CONFETTI_COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#ef4444', // red
  '#facc15', // yellow
  '#14b8a6', // teal
  '#ffffff', // white sparkle
];

export const ConfettiCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 파티클 생성 (140개)
    const pieces: ConfettiPiece[] = [];
    const count = 140;

    for (let i = 0; i < count; i++) {
      // 절반은 상단에서 쏟아지고, 절반은 좌/우/중앙 폭죽처럼 솟구쳐 오름
      const isBurst = i % 2 === 0;
      const startX = isBurst ? width * (0.3 + Math.random() * 0.4) : Math.random() * width;
      const startY = isBurst ? height * 0.6 : -20 - Math.random() * 100;
      const vx = isBurst ? (Math.random() - 0.5) * 14 : (Math.random() - 0.5) * 4;
      const vy = isBurst ? -Math.random() * 14 - 6 : Math.random() * 3 + 2;

      pieces.push({
        x: startX,
        y: startY,
        w: Math.random() * 8 + 6,
        h: Math.random() * 14 + 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        vx,
        vy,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        opacity: 1,
      });
    }

    let animationFrameId: number;
    let startTime = Date.now();

    const render = () => {
      const elapsed = Date.now() - startTime;
      ctx.clearRect(0, 0, width, height);

      let aliveCount = 0;

      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];

        // 물리 연산 (중력 및 공기 저항)
        p.vy += 0.22; // 중력
        p.vx *= 0.985; // 공기 저항
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;

        // 3.5초 후부터 천천히 페이드아웃
        if (elapsed > 3500) {
          p.opacity -= 0.02;
        }

        if (p.opacity > 0 && p.y < height + 50) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }

      if (aliveCount > 0 && elapsed < 6000) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100000]"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
};
