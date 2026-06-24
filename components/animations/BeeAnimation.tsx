"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(MotionPathPlugin);

interface BeeCfg {
  id: number;
  scale: number;
  depth: number; // 0 = far (small, blurry, slow-looking), 1 = near
  delay: number;
  duration: number;
  path: { x: number; y: number }[];
}

/** Wandering flight path: hive (left) → flowers (right) with sinusoidal drift + jitter. */
function makePath(): { x: number; y: number }[] {
  const startX = 90 + Math.random() * 60;
  const startY = 230 + (Math.random() - 0.5) * 150;
  const endX = 750 + Math.random() * 120;
  const endY = 300 + (Math.random() - 0.5) * 170;
  const waveCount = 2 + Math.random() * 2.5;
  const waveAmp = 35 + Math.random() * 45;
  const segs = 6 + Math.floor(Math.random() * 3);

  const pts = [{ x: startX, y: startY }];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    pts.push({
      x: startX + (endX - startX) * t + (Math.random() - 0.5) * 50,
      y:
        startY +
        (endY - startY) * t +
        Math.sin(t * Math.PI * waveCount) * waveAmp +
        (Math.random() - 0.5) * 30,
    });
  }
  pts.push({ x: endX, y: endY });
  return pts;
}

function makeBees(count: number): BeeCfg[] {
  return Array.from({ length: count }, (_, i) => {
    const depth = Math.random();
    return {
      id: i,
      depth,
      scale: 0.45 + depth * 0.65,
      delay: i * 0.9 + Math.random() * 0.8,
      duration: 14 - depth * 4 + Math.random() * 4, // far bees cross slower (parallax)
      path: makePath(),
    };
  });
}

function BeeSprite({ id, depth }: { id: number; depth: number }) {
  const blur = depth < 0.4 ? 0.7 : 0;
  return (
    <g
      id={`bee-outer-${id}`}
      style={{
        cursor: "pointer",
        pointerEvents: "auto",
        filter: blur ? `blur(${blur}px)` : undefined,
      }}
    >
      {/* Sprite faces RIGHT (+x) so autoRotate points the head along the flight direction */}
      <g id={`bee-inner-${id}`}>
        {/* Wings — fast flap + blur reads as motion */}
        <g id={`bee-wings-${id}`} style={{ transformOrigin: "0px -2px" }}>
          <ellipse cx="3" cy="-8" rx="4" ry="7.5" fill="url(#wingGrad)" transform="rotate(32 3 -8)" />
          <ellipse cx="-4" cy="-8" rx="3.4" ry="6.5" fill="url(#wingGrad)" opacity="0.7" transform="rotate(-24 -4 -8)" />
        </g>
        {/* Abdomen — striped, rounded (rear, left side) */}
        <ellipse cx="-4.5" cy="2" rx="7" ry="4.6" fill="url(#beeBody)" />
        <path d="M-2.2 -2.4 Q-3.4 2 -2.2 6.3" stroke="#2A1C08" strokeWidth="2" fill="none" opacity="0.75" />
        <path d="M-6.2 -2 Q-7.4 2 -6.2 5.9" stroke="#2A1C08" strokeWidth="1.8" fill="none" opacity="0.7" />
        <path d="M-9.6 -0.8 Q-10.3 2 -9.6 4.6" stroke="#2A1C08" strokeWidth="1.5" fill="none" opacity="0.6" />
        {/* Thorax — fuzzy */}
        <circle cx="3.5" cy="1" r="4" fill="#8A6516" />
        <circle cx="3.5" cy="0" r="3.6" fill="#C89530" />
        {/* Head (front, right side) */}
        <circle cx="8.5" cy="1.5" r="2.8" fill="#3A2A10" />
        <circle cx="9.3" cy="0.6" r="0.8" fill="#0D0A06" />
        {/* Antennae sweep forward */}
        <path d="M10 -0.5 Q12.5 -3.5 12 -6" stroke="#3A2A10" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <path d="M9 -1.2 Q10.5 -4.5 9.5 -7" stroke="#3A2A10" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        {/* Legs trail backwards in flight */}
        <path d="M4 4.5 L2.5 7.5 M1 5 L0.5 8 M-2.5 5 L-4 7.8" stroke="#2A1C08" strokeWidth="0.7" strokeLinecap="round" opacity="0.8" />
        {/* Body highlight */}
        <ellipse cx="-3" cy="-0.5" rx="4" ry="1.6" fill="#FFE9A0" opacity="0.35" />
        {/* Stinger at the rear */}
        <path d="M-11 2 L-13.5 2.4 L-11.2 3.2 Z" fill="#2A1C08" />
      </g>
    </g>
  );
}

export function BeeAnimation() {
  const svgRef = useRef<SVGSVGElement>(null);
  // Generated on the client only: makeBees() uses Math.random(), which would
  // produce a server/client hydration mismatch if run during render.
  const [bees, setBees] = useState<BeeCfg[]>([]);

  useEffect(() => {
    setBees(makeBees(9));
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || bees.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      bees.forEach((bee) => {
        const outer = svg.querySelector<SVGGElement>(`#bee-outer-${bee.id}`);
        const inner = svg.querySelector<SVGGElement>(`#bee-inner-${bee.id}`);
        const wings = svg.querySelector<SVGGElement>(`#bee-wings-${bee.id}`);
        if (!outer || !inner || !wings) return;

        gsap.set(outer, {
          x: bee.path[0].x,
          y: bee.path[0].y,
          scale: bee.scale,
          opacity: 0,
        });

        // Flight in two legs with a mid-route hover, like stopping at a flower.
        const pauseAt = 0.4 + Math.random() * 0.25;
        const hoverTime = 0.8 + Math.random() * 1.4;
        const leg1 = bee.duration * pauseAt;
        const leg2 = bee.duration * (1 - pauseAt);

        const tl = gsap.timeline({
          repeat: -1,
          delay: bee.delay,
          repeatDelay: 1 + Math.random() * 2.5,
        });
        tl.to(outer, { opacity: 0.35 + bee.depth * 0.65, duration: 0.7, ease: "power1.out" }, 0)
          .to(
            outer,
            {
              motionPath: { path: bee.path, curviness: 1.5, autoRotate: true, end: pauseAt },
              duration: leg1,
              ease: "power1.inOut",
            },
            0
          )
          // level out and hover in place — wings keep beating, body keeps bobbing
          .to(outer, { rotation: 0, duration: 0.5, ease: "power2.out" })
          .to(outer, { y: "-=4", duration: hoverTime / 2, yoyo: true, repeat: 1, ease: "sine.inOut" })
          .to(outer, {
            motionPath: { path: bee.path, curviness: 1.5, autoRotate: true, start: pauseAt, end: 1 },
            duration: leg2,
            ease: "power1.inOut",
          })
          .to(outer, { opacity: 0, duration: 0.8 }, "-=0.8")
          .set(outer, { x: bee.path[0].x, y: bee.path[0].y, rotation: 0 });

        // Hover jitter — constant small vertical buzz, desynced per bee
        const bob = gsap.to(inner, {
          y: 2.5 + Math.random() * 2,
          duration: 0.22 + Math.random() * 0.14,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          delay: Math.random(),
        });

        // Slow body sway — slight rocking around the flight axis
        gsap.to(inner, {
          rotation: 5 + Math.random() * 4,
          duration: 0.5 + Math.random() * 0.4,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          transformOrigin: "center",
          delay: Math.random() * 0.5,
        });
        gsap.set(inner, { rotation: -(5 + Math.random() * 4) / 2 });

        // Wing flap — very fast, slight scale + opacity flicker reads as blur
        const flap = gsap.to(wings, {
          scaleY: 0.3,
          opacity: 0.55,
          duration: 0.05,
          yoyo: true,
          repeat: -1,
          ease: "none",
        });

        // Hover: bee hovers in place, wings beat faster
        outer.addEventListener("mouseenter", () => {
          tl.pause();
          flap.timeScale(2);
        });
        outer.addEventListener("mouseleave", () => {
          tl.play();
          flap.timeScale(1);
        });

        void bob;
      });
    }, svg);

    return () => ctx.revert();
  }, [bees]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 900 560"
      className="absolute inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="beeBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8B83A" />
          <stop offset="55%" stopColor="#C89020" />
          <stop offset="100%" stopColor="#8A6010" />
        </linearGradient>
        <radialGradient id="wingGrad" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#E8E0D0" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#C8C0B0" stopOpacity="0.1" />
        </radialGradient>
      </defs>
      {bees.map((bee) => (
        <BeeSprite key={bee.id} id={bee.id} depth={bee.depth} />
      ))}
    </svg>
  );
}
