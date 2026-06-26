import { useId } from "react";

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  const r = Math.round((t - ((n >> 16) & 255)) * p + ((n >> 16) & 255));
  const g = Math.round((t - ((n >> 8) & 255)) * p + ((n >> 8) & 255));
  const b = Math.round((t - (n & 255)) * p + (n & 255));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

interface TinctureBottleProps {
  /** Liquid colour, tinted per product. */
  color?: string;
  width?: number;
  className?: string;
}

/**
 * A 20 ml dropper (tincture) bottle — amber glass, black pipette cap and a
 * small "20 ml" label. Shares the HoneyJar's 240×320 viewBox so it slots into
 * the same product slots without layout changes.
 */
export function TinctureBottle({ color = "#6B3A1F", width = 110, className }: TinctureBottleProps) {
  const id = useId();
  // Deepen the liquid a touch so the tincture reads darker than the raw colour.
  const base = shade(color, -0.2);
  const liquidLight = shade(base, 0.26);
  const liquidDark = shade(base, -0.35);

  const bodyPath =
    "M99 140 L141 140 C162 144 176 160 176 182 L176 288 C176 299 169 305 157 305 L83 305 C71 305 64 299 64 288 L64 182 C64 160 78 144 99 140 Z";

  return (
    <svg
      viewBox="0 0 240 320"
      width={width}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Sticluță de tinctură 20 ml"
    >
      <defs>
        <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8A5A2E" stopOpacity="0.55" />
          <stop offset="22%" stopColor="#C8924A" stopOpacity="0.32" />
          <stop offset="50%" stopColor="#A9702E" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#5E3A18" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`liquid-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={liquidLight} />
          <stop offset="55%" stopColor={base} />
          <stop offset="100%" stopColor={liquidDark} />
        </linearGradient>
        <linearGradient id={`cap-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0E0E10" />
          <stop offset="35%" stopColor="#3A3A40" />
          <stop offset="55%" stopColor="#24242A" />
          <stop offset="100%" stopColor="#08080A" />
        </linearGradient>
        <linearGradient id={`bulb-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1A1A1E" />
          <stop offset="40%" stopColor="#46464E" />
          <stop offset="100%" stopColor="#101014" />
        </linearGradient>
        <clipPath id={`body-${id}`}>
          <path d={bodyPath} />
        </clipPath>
      </defs>

      {/* Draw the bottle smaller than the full canvas so the element keeps the
          jar's footprint (identical card size at every breakpoint), while the
          artwork itself reads a touch smaller. */}
      <g transform="translate(120 165) scale(0.84) translate(-120 -165)">
        {/* Ground shadow */}
        <ellipse cx="120" cy="307" rx="66" ry="9" fill="#000000" opacity="0.25" />

      {/* Glass body base */}
      <path d={bodyPath} fill="#3A2614" />

      {/* Liquid filling most of the bottle, with a meniscus near the top */}
      <g clipPath={`url(#body-${id})`}>
        <rect x="60" y="178" width="120" height="130" fill={`url(#liquid-${id})`} />
        <ellipse cx="120" cy="178" rx="60" ry="7" fill={liquidLight} opacity="0.7" />
        {/* Inner shading on the sides for roundness */}
        <rect x="60" y="140" width="18" height="170" fill="#000000" opacity="0.25" />
        <rect x="162" y="140" width="18" height="170" fill="#000000" opacity="0.18" />
      </g>

      {/* Glass tint + outline over the liquid */}
      <path d={bodyPath} fill={`url(#glass-${id})`} stroke="#2A1A0C" strokeWidth="1.5" />

      {/* Pipette tube hint inside the neck/liquid */}
      <rect x="116" y="120" width="8" height="84" rx="3" fill="#FFFFFF" opacity="0.12" />

      {/* Left vertical highlight on the glass */}
      <path
        d="M82 158 C74 168 74 250 80 292"
        stroke="#FFFFFF"
        strokeOpacity="0.3"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Neck */}
      <rect x="99" y="118" width="42" height="26" fill="#4A2F18" />
      <rect x="99" y="118" width="42" height="26" fill={`url(#glass-${id})`} />

      {/* Cap collar */}
      <rect x="89" y="94" width="62" height="30" rx="5" fill={`url(#cap-${id})`} />
      <rect x="89" y="99" width="62" height="3" fill="#5A5A62" opacity="0.5" />
      <rect x="89" y="115" width="62" height="3" fill="#000000" opacity="0.4" />

      {/* Rubber bulb */}
      <rect x="101" y="44" width="38" height="54" rx="14" fill={`url(#bulb-${id})`} />
      <ellipse cx="120" cy="47" rx="18" ry="7" fill="#08080A" />
      <ellipse cx="113" cy="62" rx="4" ry="12" fill="#FFFFFF" opacity="0.22" />

      {/* Label */}
      <rect x="80" y="206" width="80" height="64" rx="6" fill="#F5ECD8" />
      <rect x="80" y="206" width="80" height="64" rx="6" fill="none" stroke="#D4A017" strokeOpacity="0.6" strokeWidth="1.5" />
      {/* Drop mark */}
      <path d="M120 218 C124 224 127 228 127 232 A7 7 0 1 1 113 232 C113 228 116 224 120 218 Z" fill={base} />
      <text
        x="120"
        y="258"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="17"
        fontWeight="700"
        fill="#3A2614"
      >
        20 ml
      </text>
      </g>
    </svg>
  );
}
