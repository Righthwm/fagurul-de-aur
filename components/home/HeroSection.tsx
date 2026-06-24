"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BeeAnimation } from "@/components/animations/BeeAnimation";
import { ParticleField } from "@/components/animations/ParticleField";
import { HoneyJar } from "@/components/ui/HoneyJar";

const fadeUp = (delay: number) => ({
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const, delay } },
});

const blurReveal = {
  hidden: { opacity: 0, filter: "blur(12px)" },
  visible: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.9, ease: "easeOut" as const, delay: 0.2 } },
};

export function HeroSection() {
  return (
    <section
      className="relative min-h-screen"
      aria-label="Secțiunea hero Stupul Bio"
    >
      <div
        className="h-screen flex items-center overflow-hidden"
        style={{ background: "var(--hero-gradient)" }}
      >
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "var(--gradient-glow)" }}
          aria-hidden="true"
        />

        {/* Floating hex particles */}
        <ParticleField count={32} />

        {/* Bee animation layer */}
        <BeeAnimation />

        {/* Left: Hive illustration */}
        <div
          className="absolute left-0 bottom-0 w-[280px] sm:w-[360px] lg:w-[420px] pointer-events-none select-none"
          aria-hidden="true"
        >
          <HiveIllustration />
        </div>

        {/* Right: Flower field */}
        <div
          className="absolute right-0 bottom-0 w-[240px] sm:w-[320px] lg:w-[400px] pointer-events-none select-none"
          aria-hidden="true"
        >
          <FlowerField />
        </div>

        {/* Center content */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 text-center pt-28 pb-24">
          {/* Skip to content */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 btn-primary text-xs"
          >
            Sari la conținut principal
          </a>

          <motion.p
            variants={fadeUp(0)}
            initial="hidden"
            animate="visible"
            className="font-body text-xs sm:text-sm font-medium uppercase tracking-[0.3em] text-gold-300 mb-4"
          >
            Natură Pură, În Fiecare Borcan
          </motion.p>

          <motion.div
            variants={blurReveal}
            initial="hidden"
            animate="visible"
            className="mb-8 flex justify-center"
          >
            <h1 className="sr-only">Stupul Bio</h1>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              {/* Full jar with lid */}
              <HoneyJar
                color="#D89A28"
                variant="hero"
                width={280}
                className="w-[200px] sm:w-[240px] lg:w-[280px] h-auto"
              />
            </motion.div>
          </motion.div>

          <motion.p
            variants={fadeUp(0.55)}
            initial="hidden"
            animate="visible"
            className="font-body text-text-secondary text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Miere artizanală pură · Recoltată cu pasiune · Livrată la tine acasă
          </motion.p>

          <motion.div
            variants={fadeUp(0.75)}
            initial="hidden"
            animate="visible"
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/magazin" className="btn-primary">
              Descoperă Mierea
            </Link>
            <Link href="/contact" className="btn-secondary">
              Contact
            </Link>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
            className="mt-16 flex flex-col items-center gap-2"
            aria-hidden="true"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-px h-12 bg-gradient-to-b from-transparent to-gold-400/40" />
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <ScrollBee />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HiveIllustration() {
  return (
    <svg viewBox="0 0 420 520" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hiveGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD980" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#FFBE47" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#D4A017" stopOpacity="0" />
        </radialGradient>
        {/* Per-plank wood gradient */}
        <linearGradient id="plankG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A2A16" />
          <stop offset="45%" stopColor="#2C2010" />
          <stop offset="100%" stopColor="#221808" />
        </linearGradient>
        <linearGradient id="plankG2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#352513" />
          <stop offset="50%" stopColor="#281C0C" />
          <stop offset="100%" stopColor="#1E1407" />
        </linearGradient>
        <linearGradient id="roofG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5A4226" />
          <stop offset="100%" stopColor="#33240F" />
        </linearGradient>
        {/* Wood grain texture */}
        <filter id="woodGrain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.18" numOctaves="3" seed="7" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.85  0 0 0 0 0.65  0 0 0 0 0.35  0 0 0 0.12 0" />
        </filter>
        <filter id="hBlur6" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="hBlur14" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <clipPath id="hiveClip">
          <path d="M80 480 L80 200 Q80 180 100 175 L260 175 Q280 180 280 200 L280 480 Z" />
        </clipPath>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="180" cy="498" rx="130" ry="14" fill="#000000" opacity="0.5" filter="url(#hBlur6)" />
      <ellipse cx="180" cy="496" rx="100" ry="9" fill="rgba(212,160,23,0.05)" />

      {/* Hive body — stacked planks with individual shading */}
      <path
        d="M80 480 L80 200 Q80 180 100 175 L260 175 Q280 180 280 200 L280 480 Z"
        fill="url(#plankG)"
        stroke="#4A3520"
        strokeWidth="1.5"
      />
      <g clipPath="url(#hiveClip)">
        {[200, 240, 280, 320, 360, 400, 440].map((y, i) => (
          <g key={y}>
            <rect x="78" y={y} width="204" height="40" fill={i % 2 ? "url(#plankG2)" : "url(#plankG)"} />
            {/* Plank top edge catches moonlight */}
            <line x1="80" y1={y} x2="280" y2={y} stroke="#6A4E2A" strokeWidth="1" opacity="0.5" />
            <line x1="80" y1={y + 1.5} x2="280" y2={y + 1.5} stroke="#120C04" strokeWidth="1.5" opacity="0.6" />
          </g>
        ))}
        {/* Wood grain noise over the whole body */}
        <rect x="78" y="172" width="206" height="312" filter="url(#woodGrain)" opacity="0.55" />
        {/* Side shading — body curvature */}
        <rect x="78" y="172" width="38" height="312" fill="#000000" opacity="0.32" />
        <rect x="244" y="172" width="38" height="312" fill="#000000" opacity="0.22" />
        {/* Warm light from entrance spilling up the front */}
        <ellipse cx="180" cy="455" rx="80" ry="48" fill="#E8A030" opacity="0.1" filter="url(#hBlur14)" />
        {/* Knots in wood */}
        <ellipse cx="120" cy="265" rx="5" ry="3.5" fill="#1A1006" opacity="0.7" />
        <ellipse cx="120" cy="265" rx="8" ry="5.5" fill="none" stroke="#1A1006" strokeWidth="1" opacity="0.35" />
        <ellipse cx="235" cy="370" rx="4" ry="3" fill="#1A1006" opacity="0.6" />
      </g>

      {/* Frame rails between supers */}
      <rect x="74" y="282" width="212" height="10" rx="2" fill="#46341C" />
      <rect x="74" y="283" width="212" height="3" rx="1.5" fill="#6A4E2A" opacity="0.6" />
      <rect x="74" y="382" width="212" height="10" rx="2" fill="#46341C" />
      <rect x="74" y="383" width="212" height="3" rx="1.5" fill="#6A4E2A" opacity="0.6" />

      {/* Roof — pitched, moonlit ridge */}
      <rect x="70" y="162" width="220" height="18" rx="3" fill="#46341C" stroke="#5A4030" strokeWidth="1" />
      <path d="M58 162 L180 112 L302 162 Z" fill="url(#roofG)" stroke="#5A4030" strokeWidth="1.5" />
      <path d="M62 160 L180 116 L298 160 Z" fill="none" stroke="#8A6A3A" strokeWidth="1" opacity="0.4" />
      {/* Roof ridge highlight */}
      <path d="M178 113 L182 113" stroke="#C8A060" strokeWidth="2" strokeLinecap="round" opacity="0.7" />

      {/* Volumetric glow outside the entrance */}
      <ellipse cx="180" cy="468" rx="60" ry="26" fill="url(#hiveGlow)" filter="url(#hBlur14)">
        <animate attributeName="opacity" values="0.75;1;0.82;0.95;0.75" dur="4.5s" repeatCount="indefinite" />
      </ellipse>

      {/* Entrance slot */}
      <rect x="143" y="453" width="74" height="20" rx="3" fill="#0E0802" />
      <rect x="146" y="456" width="68" height="14" rx="2" fill="url(#hiveGlow)">
        <animate attributeName="opacity" values="0.85;1;0.9;1;0.85" dur="3.2s" repeatCount="indefinite" />
      </rect>

      {/* Flight board with light pool */}
      <path d="M126 473 L234 473 L240 484 L120 484 Z" fill="#4A3624" />
      <path d="M126 473 L234 473 L236 477 L124 477 Z" fill="#7A5C34" opacity="0.8" />
      <ellipse cx="180" cy="478" rx="42" ry="5" fill="#FFBE47" opacity="0.3" filter="url(#hBlur6)" />

      {/* Guard bees at the entrance */}
      <g transform="translate(158, 466)" opacity="0.9">
        <ellipse cx="6" cy="2" rx="4" ry="2.6" fill="#C89020" />
        <path d="M4.5 0 Q5.2 2 4.5 4" stroke="#2A1C08" strokeWidth="1" fill="none" opacity="0.7" />
        <circle cx="1.5" cy="1.5" r="1.8" fill="#3A2A10" />
      </g>
      <g transform="translate(195, 469)" opacity="0.75" >
        <ellipse cx="5" cy="2" rx="3.4" ry="2.2" fill="#C89020" />
        <circle cx="1.5" cy="1.5" r="1.5" fill="#3A2A10" />
      </g>

      {/* Grass tufts at the base */}
      {[95, 110, 255, 272, 290].map((x, i) => (
        <g key={x} opacity="0.8">
          <path d={`M${x} 496 Q${x - 3} 482 ${x - 5} 474`} stroke="#1A2408" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d={`M${x + 3} 496 Q${x + 4} 480 ${x + 8} 472`} stroke="#222E0A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d={`M${x + 6} 496 Q${x + 5} 484 ${x + 2} 478`} stroke="#1A2408" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          {i % 2 === 0 && <circle cx={x + 8} cy={471} r="1.5" fill="#D4A017" opacity="0.5" />}
        </g>
      ))}
    </svg>
  );
}

function FlowerField() {
  return (
    <svg viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ffGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4A017" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#0D0A06" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="ffMoon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE9B0" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FFE9B0" stopOpacity="0" />
        </radialGradient>
        <filter id="ffBlur2" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="ffBlur8" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {/* Atmospheric ground haze */}
      <rect x="0" y="240" width="400" height="80" fill="url(#ffGround)" />
      <ellipse cx="220" cy="280" rx="180" ry="34" fill="#C49050" opacity="0.07" filter="url(#ffBlur8)" />

      {/* Back layer — hazy, out of focus */}
      <g filter="url(#ffBlur2)" opacity="0.45">
        {[20, 70, 120, 185, 250, 310, 365].map((x, i) => (
          <FlowerSilhouette key={`b${x}`} x={x} height={90 + (i % 3) * 20} tone="#6A4A1C" sway={false} headR={5} />
        ))}
      </g>

      {/* Mid layer */}
      <g opacity="0.75">
        {[45, 100, 160, 225, 290, 345].map((x, i) => (
          <FlowerSilhouette key={`m${x}`} x={x} height={130 + (i % 4) * 22} tone="#3A2A0E" sway={i % 2 === 0} headR={7} />
        ))}
      </g>

      {/* Front layer — near-black silhouettes, sharp */}
      <g>
        {[15, 85, 150, 215, 280, 350].map((x, i) => (
          <FlowerSilhouette key={`f${x}`} x={x} height={175 + (i % 3) * 30} tone="#16100A" sway rim headR={9 + (i % 2) * 3} />
        ))}
        {/* Tall grass blades */}
        {Array.from({ length: 22 }, (_, i) => {
          const gx = 8 + i * 18 + (i % 3) * 5;
          const h = 30 + (i % 5) * 14;
          const bend = (i % 2 === 0 ? 1 : -1) * (4 + (i % 4) * 2);
          return (
            <path
              key={`g${i}`}
              d={`M${gx} 318 Q${gx + bend * 0.4} ${318 - h * 0.6} ${gx + bend} ${318 - h}`}
              stroke="#14100A"
              strokeWidth={1 + (i % 3) * 0.4}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* Fireflies */}
      {[
        [120, 180],
        [260, 150],
        [330, 200],
      ].map(([fx, fy], i) => (
        <circle key={`fl${i}`} cx={fx} cy={fy} r="1.6" fill="#FFE9A0">
          <animate
            attributeName="opacity"
            values={i % 2 ? "0;0.9;0.2;0.7;0" : "0.7;0.1;0.9;0;0.7"}
            dur={`${3.5 + i}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

function FlowerSilhouette({
  x,
  height,
  tone,
  sway,
  rim,
  headR,
}: {
  x: number;
  height: number;
  tone: string;
  sway?: boolean;
  rim?: boolean;
  headR: number;
}) {
  const baseY = 318;
  const topY = baseY - height;
  const bend = 6 + (x % 10);
  return (
    <g style={{ transformOrigin: `${x}px ${baseY}px` }}>
      {sway && (
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`-1.2 ${x} ${baseY}; 1.4 ${x} ${baseY}; -1.2 ${x} ${baseY}`}
          dur={`${4 + (x % 5)}s`}
          repeatCount="indefinite"
        />
      )}
      {/* Curved stem */}
      <path
        d={`M${x} ${baseY} Q${x + bend * 0.3} ${baseY - height * 0.55} ${x + bend * 0.7} ${topY + headR}`}
        stroke={tone}
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Leaves */}
      <path
        d={`M${x + bend * 0.15} ${baseY - height * 0.4} Q${x - 12} ${baseY - height * 0.48} ${x - 16} ${baseY - height * 0.38}`}
        stroke={tone}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Drooping flower head */}
      <circle cx={x + bend * 0.7} cy={topY + headR * 0.6} r={headR} fill={tone} />
      {/* Petal fringe */}
      {[0, 1, 2, 3, 4, 5].map((p) => {
        const a = (Math.PI * 2 * p) / 6 + 0.3;
        return (
          <ellipse
            key={p}
            cx={x + bend * 0.7 + headR * 1.15 * Math.cos(a)}
            cy={topY + headR * 0.6 + headR * 1.15 * Math.sin(a)}
            rx={headR * 0.55}
            ry={headR * 0.3}
            fill={tone}
            transform={`rotate(${(a * 180) / Math.PI} ${x + bend * 0.7 + headR * 1.15 * Math.cos(a)} ${topY + headR * 0.6 + headR * 1.15 * Math.sin(a)})`}
          />
        );
      })}
      {/* Moonlit rim on front flowers */}
      {rim && (
        <path
          d={`M${x + bend * 0.7 - headR} ${topY + headR * 0.5} A${headR} ${headR} 0 0 1 ${x + bend * 0.7 + headR * 0.4} ${topY - headR * 0.35}`}
          stroke="#C49050"
          strokeWidth="1"
          fill="none"
          opacity="0.55"
        />
      )}
    </g>
  );
}

function ScrollBee() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
      <ellipse cx="10" cy="8" rx="5.5" ry="4" fill="#D4A017" />
      <ellipse cx="10" cy="8" rx="5.5" ry="4" fill="url(#sb)" opacity="0.5" />
      <circle cx="10" cy="3.5" r="3" fill="#D4A017" />
      <ellipse cx="4" cy="7" rx="5" ry="2.5" fill="#D4A017" fillOpacity="0.35" transform="rotate(-15 4 7)" />
      <ellipse cx="16" cy="7" rx="5" ry="2.5" fill="#D4A017" fillOpacity="0.35" transform="rotate(15 16 7)" />
      <defs>
        <pattern id="sb" patternUnits="userSpaceOnUse" width="4" height="4">
          <rect width="2" height="4" fill="rgba(0,0,0,0.3)" />
        </pattern>
      </defs>
    </svg>
  );
}
