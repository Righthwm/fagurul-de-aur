"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  drift: number;
  rotation: number;
  rotationSpeed: number;
  phase: number;
  swayAmp: number;
  isHex: boolean;
  twinkle: number;
}

export function ParticleField({ count = 35 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let tick = 0;
    const particles: Particle[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();

    const hexPath = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    };

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 1.5 + Math.random() * 3.5,
        opacity: 0.08 + Math.random() * 0.3,
        speed: 0.1 + Math.random() * 0.3,
        drift: (Math.random() - 0.5) * 0.15,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.006,
        phase: Math.random() * Math.PI * 2,
        swayAmp: 0.2 + Math.random() * 0.5,
        // Mostly round pollen motes, some hex sparks
        isHex: Math.random() < 0.35,
        twinkle: 0.5 + Math.random() * 2,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick += 0.016;

      for (const p of particles) {
        // Twinkle: slow sinusoidal brightness, like dust catching light
        const flicker = 0.65 + 0.35 * Math.sin(tick * p.twinkle + p.phase);
        const alpha = p.opacity * flicker;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = alpha;

        if (p.size > 3.2) {
          // Larger motes get a soft glow
          ctx.shadowColor = "rgba(245, 197, 24, 0.7)";
          ctx.shadowBlur = 7;
        }

        ctx.fillStyle = p.isHex ? "#F5C518" : "#E8C97A";

        if (p.isHex) {
          hexPath(ctx, 0, 0, p.size);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Drift upward with gentle horizontal sway — like dust in still air
        p.y -= p.speed;
        p.x += p.drift + Math.sin(tick * 0.6 + p.phase) * p.swayAmp * 0.3;
        p.rotation += p.rotationSpeed;

        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
