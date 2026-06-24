export function HoneyDropLoader({ size = 48 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center"
      role="status"
      aria-label="Se încarcă..."
      style={{ width: size, height: size * 1.4 }}
    >
      <svg
        width={size * 0.6}
        height={size}
        viewBox="0 0 30 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Honey drop shape */}
        <path
          d="M15 2 C15 2, 28 20, 28 32 C28 42, 22 48, 15 48 C8 48, 2 42, 2 32 C2 20, 15 2, 15 2Z"
          fill="url(#honeyGrad)"
          style={{
            animation: "honey-drip 1.4s ease-in-out infinite",
            transformOrigin: "top center",
          }}
        />
        {/* Shine */}
        <ellipse cx="10" cy="22" rx="3" ry="5" fill="rgba(255,255,255,0.3)" transform="rotate(-20 10 22)" />
        <defs>
          <linearGradient id="honeyGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFBE47" />
            <stop offset="100%" stopColor="#D4A017" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
