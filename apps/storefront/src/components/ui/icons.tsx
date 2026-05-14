type IconProps = { size?: number; className?: string };

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  Cart: ({ size = 20, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </svg>
  ),
  Heart: ({ size = 20, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <path d="M12 20s-7-4.5-9.3-9C1.4 8.4 3.4 5 6.5 5c2 0 3.4 1 4.5 2.5h2C14 6 15.5 5 17.5 5c3.1 0 5.1 3.4 3.8 6-2.3 4.5-9.3 9-9.3 9z" />
    </svg>
  ),
  HeartFill: ({ size = 20, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 20s-7-4.5-9.3-9C1.4 8.4 3.4 5 6.5 5c2 0 3.4 1 4.5 2.5h2C14 6 15.5 5 17.5 5c3.1 0 5.1 3.4 3.8 6-2.3 4.5-9.3 9-9.3 9z" />
    </svg>
  ),
  User: ({ size = 20, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </svg>
  ),
  Search: ({ size = 20, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  ),
  Globe: ({ size = 20, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  ),
  Menu: ({ size = 20, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  Chevron: ({ size = 16, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  Close: ({ size = 18, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Check: ({ size = 16, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <path d="M5 12l4 4 10-10" />
    </svg>
  ),
  Plus: ({ size = 16, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Minus: ({ size = 16, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <path d="M5 12h14" />
    </svg>
  ),
  Trash: ({ size = 18, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}>
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  ),
  Logo: ({ size = 28, className }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#a13b4b" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="22" fill="#faf6f1" fontStyle="italic">c</text>
    </svg>
  )
};
