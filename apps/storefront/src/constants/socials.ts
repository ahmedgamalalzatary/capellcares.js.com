export interface SocialLink {
  label: "Facebook" | "Instagram" | "TikTok" | "YouTube" | "WhatsApp";
  href: string;
  /** Icon outline, on a 24 by 24 grid. */
  path: string;
  stroke: boolean;
}

/** Falta Toy's accounts. The footer and menu hide these sections while the list is empty. */
export const SOCIAL_LINKS: SocialLink[] = [];

export const WHATSAPP_URL = "https://wa.me/201034668590";
