import type { CSSProperties } from "react";

type IconProps = { size?: number; className?: string; style?: CSSProperties };

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  // Cart glyph only. The item count is rendered as a separate HTML corner badge by the header so it can never be clipped by the SVG viewBox.
  Cart: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M2.5 4.5h2.3l2 9.8a1.7 1.7 0 0 0 1.7 1.4h8a1.7 1.7 0 0 0 1.7-1.3L21.8 6" />
      <circle cx="9" cy="20" r="1.4" />
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
  ArrowUp: ({ size = 22, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M12 19V5M5 12l7-7 7 7" />
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
  Image: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.6" />
      <path d="m21 15-4.5-4.5L6 21" />
    </svg>
  ),
  Upload: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  ColumnsOne: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
  ColumnsTwo: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  ),
  Visa: ({ className, style }: IconProps) => (
    <svg viewBox="0 0 48 16" className={className} style={style} role="img" aria-label="Visa">
      <text
        x="24"
        y="13"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="15"
        letterSpacing="0.5"
        fill="#1434CB"
      >
        VISA
      </text>
    </svg>
  ),
  Mastercard: ({ className, style }: IconProps) => (
    <svg viewBox="0 0 40 24" className={className} style={style} role="img" aria-label="Mastercard">
      <circle cx="15" cy="12" r="10" fill="#EB001B" />
      <circle cx="25" cy="12" r="10" fill="#F79E1B" />
      <path
        d="M20 4.2a10 10 0 0 0 0 15.6 10 10 0 0 0 0-15.6z"
        fill="#FF5F00"
      />
    </svg>
  ),
  Logo: ({ size = 28, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#a13b4b" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="22" fill="#faf6f1">c</text>
    </svg>
  )
};
