"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(MotionPathPlugin);

interface Pt {
  x: number;
  y: number;
}

// Fixed depths (0 = far/small/blurry, 1 = near) keep the rendered markup
// identical on server and client; all motion randomness lives in the effect.
const DEPTHS = [0.2, 0.85, 0.5, 0.95, 0.32, 0.7, 0.14, 0.62, 0.9];

// The nearest bees fly on a layer ABOVE the jar (passing in front of it);
// the rest stay behind it. Membership decides which <svg> layer renders a bee.
// Threshold 0.65 selects the 4 highest-depth bees (0.7, 0.85, 0.9, 0.95).
const FRONT_IDS = new Set(DEPTHS.map((d, i) => (d > 0.65 ? i : -1)).filter((i) => i >= 0));

/**
 * Wandering flight in two arcs: hive entrance → UP toward the jar (apex) →
 * DOWN onto a flower. Drift (sine + jitter) is added everywhere except the
 * fixed anchor points so the rise-then-fall shape stays readable.
 */
function makePath(s: Pt, apex: Pt, t: Pt, minY: number, maxY: number): Pt[] {
  const amp = 30 + Math.random() * 45;
  const waves = 1.1 + Math.random() * 1.6;
  const drift = (bx: number, by: number, tt: number, k: number): Pt => {
    const x = bx + k * (Math.random() - 0.5) * 70;
    let y = by + k * (Math.sin(tt * Math.PI * waves) * amp + (Math.random() - 0.5) * 40);
    y = Math.max(minY, Math.min(maxY, y));
    return { x, y };
  };

  const up = 3 + Math.floor(Math.random() * 2); // segments rising to the apex
  const down = 4 + Math.floor(Math.random() * 3); // segments descending to flower
  const pts: Pt[] = [{ x: s.x, y: s.y }];
  for (let i = 1; i <= up; i++) {
    const tt = i / up;
    pts.push(drift(s.x + (apex.x - s.x) * tt, s.y + (apex.y - s.y) * tt, tt, i === up ? 0 : 1));
  }
  for (let i = 1; i <= down; i++) {
    const tt = i / down;
    pts.push(drift(apex.x + (t.x - apex.x) * tt, apex.y + (t.y - apex.y) * tt, tt, i === down ? 0 : 1));
  }
  return pts;
}

/** Honeybee sprite, facing +x so MotionPath autoRotate points the head forward. */
function BeeSprite({ id, depth, interactive }: { id: number; depth: number; interactive: boolean }) {
  const blur = depth < 0.4 ? 0.6 : 0;
  return (
    <g
      id={`bee-outer-${id}`}
      style={{
        cursor: interactive ? "pointer" : "default",
        pointerEvents: interactive ? "auto" : "none",
        filter: blur ? `blur(${blur}px)` : undefined,
      }}
    >
      <g id={`bee-inner-${id}`}>
        {/* WINGS — drawn behind the body, sweep up-and-back, faintly veined */}
        <g id={`bee-wings-${id}`} style={{ transformOrigin: "1px -3px" }}>
          <path className="bee-wing" d="M1 -3 C -7 -10 -13 -10 -15 -7 C -12 -2 -4 -1 1 -3 Z" fill="url(#wingGrad)" opacity="0.5" />
          <path className="bee-wing" d="M2 -3 C -4 -14 -12 -15 -14 -11 C -9 -4 -2 -3 2 -3 Z" fill="url(#wingGrad)" opacity="0.62" />
          <path className="bee-vein" d="M1 -3 C -4 -11 -10 -12 -13 -10" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="0.4" fill="none" />
          <path className="bee-vein" d="M0 -2.4 C -5 -7 -10 -8 -13 -7" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="0.35" fill="none" />
          <path className="bee-vein" d="M-6 -10.5 C -7 -7 -8 -5 -7 -3" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="0.3" fill="none" />
        </g>

        {/* Far legs (behind body) */}
        <path d="M0 4 L-2 8 M-4 4 L-6 8" stroke="#241808" strokeWidth="0.7" strokeLinecap="round" opacity="0.45" />

        {/* ABDOMEN — pointed at the rear (left), amber with dark bands */}
        <path
          d="M3 1 Q3.4 5.2 -2 5.6 L-12.5 3 Q-15.5 1.2 -12.5 -1 L-2 -3.6 Q3.4 -3.2 3 1 Z"
          fill="url(#beeAbd)"
        />
        <path d="M-1 -3.4 Q-2.2 1 -1 5.4" stroke="#241405" strokeWidth="2.1" fill="none" />
        <path d="M-5 -3.1 Q-6 1 -5 4.9" stroke="#241405" strokeWidth="2" fill="none" />
        <path d="M-9 -2.2 Q-9.8 1 -9 4" stroke="#241405" strokeWidth="1.7" fill="none" />
        {/* Dark pointed tip */}
        <path d="M-12.5 3 Q-15.6 1.1 -12.5 -1 Q-13.8 1 -12.5 3 Z" fill="#1C1404" />
        {/* Sheen */}
        <ellipse cx="-4.5" cy="-1.4" rx="6" ry="1.4" fill="#FFE9A0" opacity="0.3" />

        {/* THORAX — fuzzy amber */}
        <circle cx="2.5" cy="0.5" r="4.6" fill="#6E4E12" />
        <circle cx="2.5" cy="0" r="4.2" fill="url(#beeThorax)" />
        <g stroke="#CAA23A" strokeWidth="0.5" opacity="0.7" strokeLinecap="round">
          <path d="M-1.5 -3 l-1 -1" />
          <path d="M2 -4.2 l0 -1.3" />
          <path d="M5.5 -3 l1 -1" />
          <path d="M6.6 1 l1.3 0.3" />
          <path d="M-2 3.6 l-1 0.8" />
        </g>

        {/* HEAD + compound eye */}
        <circle cx="8.2" cy="1" r="3.1" fill="#2A1C0A" />
        <ellipse cx="8.9" cy="0.4" rx="1.5" ry="2" fill="#0D0A06" />
        <circle cx="8.4" cy="-0.3" r="0.5" fill="#5A4A2A" opacity="0.8" />
        {/* Proboscis */}
        <path d="M9 3 l0.4 2" stroke="#1C1404" strokeWidth="0.6" strokeLinecap="round" />
        {/* Antennae */}
        <path d="M10 -1 Q13 -4 12.5 -6.5" stroke="#1C1404" strokeWidth="0.7" fill="none" strokeLinecap="round" />
        <path d="M9.5 -1.6 Q11.5 -5 10.8 -7.2" stroke="#1C1404" strokeWidth="0.7" fill="none" strokeLinecap="round" />

        {/* Near legs */}
        <path
          d="M4 4 L3 8 M1.5 4.6 L0.8 8.4 M-1.5 4.6 L-2.5 8"
          stroke="#241808"
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>
    </g>
  );
}

export function BeeAnimation() {
  const backRef = useRef<SVGSVGElement>(null);
  const frontRef = useRef<SVGSVGElement>(null);
  const [resizeKey, setResizeKey] = useState(0);

  // Rebuild flight paths when the layout changes (breakpoint / window resize),
  // so spawn/target stay glued to the hive and flowers.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setResizeKey((k) => k + 1), 250);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const back = backRef.current;
    const front = frontRef.current;
    if (!back || !front) return;

    const hide = () =>
      gsap.set(
        [...back.querySelectorAll('[id^="bee-outer-"]'), ...front.querySelectorAll('[id^="bee-outer-"]')],
        { opacity: 0 }
      );
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hide();
      return;
    }

    // Map a viewport (client) point into the SVG user coordinate space. Both
    // layers share the same viewBox/size/position, so one matrix serves both.
    const ctm = back.getScreenCTM();
    const hive = document.getElementById("hero-hive");
    const flowers = document.getElementById("hero-flowers");
    if (!ctm || !hive || !flowers) {
      hide();
      return;
    }
    const inv = ctm.inverse();
    const toVB = (cx: number, cy: number): Pt => {
      const p = new DOMPoint(cx, cy).matrixTransform(inv);
      return { x: p.x, y: p.y };
    };

    const vb = back.viewBox.baseVal;
    const hr = hive.getBoundingClientRect();
    const fr = flowers.getBoundingClientRect();
    const jar = document.getElementById("hero-jar");
    const jrect = jar?.getBoundingClientRect() ?? null;

    const ctx = gsap.context(() => {
      DEPTHS.forEach((depth, id) => {
        const root = FRONT_IDS.has(id) ? front : back;
        const outer = root.querySelector<SVGGElement>(`#bee-outer-${id}`);
        const inner = root.querySelector<SVGGElement>(`#bee-inner-${id}`);
        const wings = root.querySelector<SVGGElement>(`#bee-wings-${id}`);
        if (!outer || !inner || !wings) return;

        const scale = 0.5 + depth * 0.7;
        // Staggered emission so they stream out of the hive one after another
        const delay = id * 0.7 + Math.random() * 0.6;
        const duration = 13 - depth * 4 + Math.random() * 4; // far bees slower (parallax)

        // Spawn at the hive's landing board (lower-centre of the hive photo)…
        const start = toVB(
          hr.left + hr.width * (0.4 + Math.random() * 0.2),
          hr.top + hr.height * (0.74 + Math.random() * 0.12)
        );
        // …rising first toward the jar (apex, high in the centre)…
        const apex = jrect
          ? toVB(
              jrect.left + jrect.width * (0.1 + Math.random() * 0.8),
              jrect.top + jrect.height * (Math.random() * 0.45)
            )
          : toVB(window.innerWidth * 0.5 + (Math.random() - 0.5) * 220, window.innerHeight * 0.28);
        // …then descending onto a random bloom within the flower cluster.
        const target = toVB(
          fr.left + fr.width * (0.2 + Math.random() * 0.55),
          fr.top + fr.height * (0.12 + Math.random() * 0.45)
        );
        const path = makePath(start, apex, target, vb.y + 30, vb.y + vb.height - 30);

        gsap.set(outer, { x: start.x, y: start.y, scale, opacity: 0 });
        const vis = 0.4 + depth * 0.6;

        const tl = gsap.timeline({
          repeat: -1,
          delay,
          repeatDelay: 1.5 + Math.random() * 3,
        });
        tl.to(outer, { opacity: vis, duration: 0.6, ease: "power1.out" }, 0)
          .to(
            outer,
            {
              motionPath: { path, curviness: 1.45, autoRotate: true },
              duration,
              ease: "power1.inOut",
            },
            0
          )
          // Settle onto the flower: level out and hover a moment
          .to(outer, { rotation: 0, duration: 0.4, ease: "power2.out" })
          .to(outer, { y: "-=5", duration: 0.5, yoyo: true, repeat: 3, ease: "sine.inOut" })
          .to(outer, { opacity: 0, duration: 0.7 })
          .set(outer, { x: start.x, y: start.y, rotation: 0 });

        // Constant small vertical buzz
        gsap.to(inner, {
          y: 2.5 + Math.random() * 2,
          duration: 0.22 + Math.random() * 0.14,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          delay: Math.random(),
        });

        // Slow body rock around the flight axis
        gsap.set(inner, { rotation: -(5 + Math.random() * 4) / 2 });
        gsap.to(inner, {
          rotation: 5 + Math.random() * 4,
          duration: 0.5 + Math.random() * 0.4,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          transformOrigin: "center",
          delay: Math.random() * 0.5,
        });

        // Wing flap — very fast, scale + opacity flicker reads as motion blur
        const flap = gsap.to(wings, {
          scaleY: 0.3,
          opacity: 0.55,
          duration: 0.05,
          yoyo: true,
          repeat: -1,
          ease: "none",
        });

        // Hover-to-pause only for the back (interactive) bees; the front layer
        // is pointer-events-none so it never blocks the hero buttons.
        if (!FRONT_IDS.has(id)) {
          outer.addEventListener("mouseenter", () => {
            tl.pause();
            flap.timeScale(2);
          });
          outer.addEventListener("mouseleave", () => {
            tl.play();
            flap.timeScale(1);
          });
        }
      });
    });

    return () => ctx.revert();
  }, [resizeKey]);

  const svgProps = {
    viewBox: "0 0 900 560",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
    style: { pointerEvents: "none" as const },
    preserveAspectRatio: "xMidYMid slice",
  };

  return (
    <>
      {/* Back layer — behind the honey jar (jar is z-10) */}
      <svg ref={backRef} {...svgProps} className="absolute inset-0 w-full h-full z-[5]">
        <defs>
          <linearGradient id="beeAbd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F2C24A" />
            <stop offset="55%" stopColor="#D89A28" />
            <stop offset="100%" stopColor="#A06A12" />
          </linearGradient>
          <radialGradient id="beeThorax" cx="45%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#E8B53C" />
            <stop offset="70%" stopColor="#B0801C" />
            <stop offset="100%" stopColor="#7A5410" />
          </radialGradient>
          <radialGradient id="wingGrad" cx="60%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
            <stop offset="65%" stopColor="#EAE2D2" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#C8C0B0" stopOpacity="0.1" />
          </radialGradient>
        </defs>
        {DEPTHS.map((depth, id) =>
          FRONT_IDS.has(id) ? null : <BeeSprite key={id} id={id} depth={depth} interactive />
        )}
      </svg>

      {/* Front layer — above the jar; these bees pass in front of it */}
      <svg ref={frontRef} {...svgProps} className="absolute inset-0 w-full h-full z-20">
        {DEPTHS.map((depth, id) =>
          FRONT_IDS.has(id) ? <BeeSprite key={id} id={id} depth={depth} interactive={false} /> : null
        )}
      </svg>
    </>
  );
}
