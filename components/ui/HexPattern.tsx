"use client";

import { useId } from "react";

interface HexPatternProps {
  opacity?: number;
  className?: string;
}

export function HexPattern({ opacity = 0.03, className = "" }: HexPatternProps) {
  // useId() is stable across the server/client boundary; Math.random() here
  // would cause a hydration mismatch (and the id is unique per instance).
  const id = `hex-${useId()}`;
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id={id} x="0" y="0" width="28" height="32" patternUnits="userSpaceOnUse">
          <path
            d="M14 2 L26 9 L26 23 L14 30 L2 23 L2 9 Z"
            fill="none"
            stroke="#D4A017"
            strokeWidth="0.7"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </svg>
  );
}
