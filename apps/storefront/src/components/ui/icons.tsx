import type { CSSProperties } from "react";

type IconProps = { size?: number; className?: string; style?: CSSProperties };

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  Cart: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </svg>
  ),
  Heart: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M12 20s-7-4.5-9.3-9C1.4 8.4 3.4 5 6.5 5c2 0 3.4 1 4.5 2.5h2C14 6 15.5 5 17.5 5c3.1 0 5.1 3.4 3.8 6-2.3 4.5-9.3 9-9.3 9z" />
    </svg>
  ),
  HeartFill: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12 20s-7-4.5-9.3-9C1.4 8.4 3.4 5 6.5 5c2 0 3.4 1 4.5 2.5h2C14 6 15.5 5 17.5 5c3.1 0 5.1 3.4 3.8 6-2.3 4.5-9.3 9-9.3 9z" />
    </svg>
  ),
  User: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </svg>
  ),
  Search: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  ),
  Globe: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  ),
  Menu: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  Chevron: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  Close: ({ size = 18, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Check: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M5 12l4 4 10-10" />
    </svg>
  ),
  Plus: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Minus: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M5 12h14" />
    </svg>
  ),
  Trash: ({ size = 18, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  ),
  Shop: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={`icon-shop${className ? ` ${className}` : ""}`} style={style}>
      <style>{`.icon-shop line{transition:transform .25s ease,opacity .2s ease;transform-box:fill-box;transform-origin:center}.icon-shop:hover line:nth-of-type(1){transform:translateY(6px) rotate(45deg)}.icon-shop:hover line:nth-of-type(2){opacity:0}.icon-shop:hover line:nth-of-type(3){transform:translateY(-6px) rotate(-45deg)}`}</style>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  ),
  Visa: ({ className, style }: IconProps) => (
    <svg viewBox="0 0 48 16" className={className} style={style} role="img" aria-label="Visa">
      <text
        x="24"
        y="13"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontWeight="700"
        fontSize="15"
        letterSpacing="0.5"
        fill="#1434CB"
      >
        VISA
      </text>
    </svg>
  ),
  Paymob: ({ className, style }: IconProps) => (
    <svg viewBox="0 0 56 16" className={className} style={style} role="img" aria-label="Paymob">
      <text x="0" y="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="14" fill="#0A2540">
        pay
      </text>
      <text x="24" y="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="14" fill="#16B364">
        mob
      </text>
    </svg>
  ),
  Apple: ({ size = 24, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden>
      <path d="M16.36 12.7c-.02-2.04 1.67-3.02 1.74-3.07-.95-1.39-2.43-1.58-2.96-1.6-1.26-.13-2.46.74-3.1.74-.64 0-1.62-.72-2.67-.7-1.37.02-2.64.8-3.35 2.03-1.43 2.48-.37 6.15 1.02 8.16.68.99 1.49 2.1 2.55 2.06 1.02-.04 1.41-.66 2.65-.66 1.23 0 1.58.66 2.66.64 1.1-.02 1.79-1 2.46-2 .78-1.15 1.1-2.26 1.12-2.32-.02-.01-2.15-.83-2.17-3.28zM14.6 6.4c.56-.68.94-1.62.83-2.56-.81.03-1.78.54-2.36 1.21-.52.6-.98 1.56-.86 2.48.9.07 1.83-.46 2.39-1.13z" />
    </svg>
  ),
  GooglePlay: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path d="M3.6 2.3c-.25.26-.4.66-.4 1.18v17.04c0 .52.15.92.4 1.18l.06.05L13.1 12.1v-.2L3.66 2.25l-.06.05z" fill="#00D3FF" />
      <path d="M16.25 15.25 13.1 12.1v-.2l3.16-3.16.07.04 3.74 2.13c1.07.6 1.07 1.6 0 2.21l-3.74 2.13-.08.04z" fill="#FFCE00" />
      <path d="M16.32 15.21 13.1 12 3.6 21.7c.35.37.93.42 1.59.05l11.13-6.54z" fill="#FF3D47" />
      <path d="M16.32 8.79 5.19 2.25c-.66-.37-1.24-.32-1.59.05L13.1 12l3.22-3.21z" fill="#00F076" />
    </svg>
  ),
  Logo: ({ size = 28, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#a13b4b" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="22" fill="#faf6f1" fontStyle="italic">c</text>
    </svg>
  )
};
