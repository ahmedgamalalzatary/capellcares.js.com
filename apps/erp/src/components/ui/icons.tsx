type P = { size?: number; className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  Dashboard: ({ size = 18, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>),
  Box: ({ size = 18, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>),
  Folder: ({ size = 18, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/></svg>),
  Tag: ({ size = 18, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.5"/></svg>),
  Trash: ({ size = 18, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>),
  Plus: ({ size = 16, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M12 5v14M5 12h14"/></svg>),
  Minus: ({ size = 16, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M5 12h14"/></svg>),
  Edit: ({ size = 16, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M4 20h4l11-11-4-4L4 16v4z"/></svg>),
  Search: ({ size = 16, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><circle cx="11" cy="11" r="6"/><path d="m16.5 16.5 4 4"/></svg>),
  Logout: ({ size = 18, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h12"/></svg>),
  Eye: ({ size = 16, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>),
  Upload: ({ size = 18, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>),
  Check: ({ size = 16, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M5 12l4 4 10-10"/></svg>),
  X: ({ size = 16, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M6 6l12 12M18 6 6 18"/></svg>),
  Chevron: ({ size = 14, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="m6 9 6 6 6-6"/></svg>),
  More: ({ size = 16, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>),
  Logo: ({ size = 28, className }: P) => (<svg width={size} height={size} viewBox="0 0 40 40" className={className}><circle cx="20" cy="20" r="18" fill="#a13b4b"/><text x="20" y="26" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="22" fill="#faf6f1">c</text></svg>),
  Sparkle: ({ size = 16, className }: P) => (<svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/></svg>)
};
