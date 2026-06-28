// Global UI / styling defaults shared across storefront components.

// Shop media strip (carousel) behaviour.
export const SHOP_MEDIA_AUTOPLAY_MS = 5000;
export const SHOP_MEDIA_SWIPE_THRESHOLD_PX = 50;
export const SHOP_MEDIA_DESKTOP_MEDIA_QUERY = "(min-width: 640px)";

// Header search overlay.
export const SEARCH_MAX_RESULTS = 6;

// The desktop mega menu reveals at min-[880px]; keep the drawer's auto-close in sync.
export const DESKTOP_BREAKPOINT = 880;

// Announcement bar timing.
// Total per-sentence cycle: fast in (~0.6s) · hold centered (~5s) · fast out (~0.4s).
export const ANNOUNCEMENT_CROSS_S = 6;
// Pause between sentences when reduced-motion is on (no slide animation).
export const ANNOUNCEMENT_REDUCED_HOLD_MS = 3500;
