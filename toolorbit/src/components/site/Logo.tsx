export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#lg)" />
      <ellipse cx="16" cy="16" rx="11" ry="4.6" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1.8" transform="rotate(-28 16 16)" />
      <circle cx="16" cy="16" r="4.2" fill="#fff" />
      <circle cx="25.2" cy="11.4" r="1.9" fill="#fff" />
    </svg>
  );
}
