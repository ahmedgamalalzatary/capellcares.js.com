// Lightweight SVG illustrations keyed by product slug so the storefront feels
// finished without needing real photography uploaded yet.
import Image from "next/image";
import type { Product } from "@capella/shared";

const palettes: Record<string, { bg: string; bottle: string; accent: string; cap: string }> = {
  "rose-petal-body-lotion": { bg: "#f6e3e5", bottle: "#fff0f1", accent: "#a13b4b", cap: "#5a4f47" },
  "vitamin-c-radiance-serum": { bg: "#fdebcb", bottle: "#fff7e3", accent: "#d18b1f", cap: "#5a4f47" },
  "argan-shine-hair-oil": { bg: "#efe1c2", bottle: "#fbe9b8", accent: "#b58950", cap: "#3a2e1d" },
  "coffee-body-scrub": { bg: "#e9d6c1", bottle: "#7a4a2a", accent: "#3a2516", cap: "#1f1410" },
  "vanilla-honey-lip-balm": { bg: "#f4e7c5", bottle: "#ffe7a3", accent: "#b58950", cap: "#5a4f47" },
  "rose-oud-eau-de-parfum": { bg: "#dec8cb", bottle: "#7a3242", accent: "#3a1a23", cap: "#b58950" },
  "oatmeal-honey-soap-bar": { bg: "#f1e6c6", bottle: "#e6d09a", accent: "#a07b3a", cap: "#5a4f47" },
  "amber-soy-candle": { bg: "#e8d3b3", bottle: "#c89261", accent: "#7a4a1d", cap: "#3a2e1d" },
  "pure-coconut-oil": { bg: "#eef0e2", bottle: "#ffffff", accent: "#3e7a4d", cap: "#5a4f47" },
  "matte-lipstick-desert-nude": { bg: "#e9d6c8", bottle: "#c98e74", accent: "#7a3a23", cap: "#1f1410" },
  "cocoa-body-butter": { bg: "#e0c9af", bottle: "#fff3d6", accent: "#6a3f24", cap: "#3a2516" },
  "fresh-mint-shampoo": { bg: "#d6e8d4", bottle: "#b5d9a8", accent: "#3e7a4d", cap: "#23351f" }
};

function pickPalette(slug: string) {
  return palettes[slug] ?? { bg: "#f1ece2", bottle: "#fff", accent: "#a13b4b", cap: "#5a4f47" };
}

interface Props {
  product: Pick<Product, "slug" | "name" | "imagePath">;
  className?: string;
}

export function ProductIllustration({ product, className }: Props) {
  if (product.imagePath) {
    return (
      <Image
        className={className ?? "h-full w-full object-contain rounded-lg"}
        src={product.imagePath}
        alt={product.name.en}
        width={800}
        height={1000}
        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 34vw, 78vw"
      />
    );
  }

  const p = pickPalette(product.slug);
  const initials = product.name.en.split(" ").slice(0, 2).map((s) => s[0]).join("");
  return (
    <svg
      className={className}
      viewBox="0 0 200 240"
      role="img"
      aria-label={product.name.en}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`bg-${product.slug}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={p.bg} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect width="200" height="240" fill={`url(#bg-${product.slug})`} />
      {/* Bottle */}
      <rect x="60" y="60" width="80" height="140" rx="14" fill={p.bottle} stroke={p.accent} strokeWidth="1.5" />
      <rect x="80" y="42" width="40" height="22" rx="4" fill={p.cap} />
      <rect x="74" y="60" width="52" height="6" fill={p.cap} opacity="0.25" />
      {/* Label */}
      <rect x="72" y="110" width="56" height="60" rx="4" fill="#ffffff" opacity="0.85" />
      <text
        x="100" y="138" textAnchor="middle"
        fontFamily="Cormorant Garamond, serif"
        fontSize="14" fill={p.accent}
      >Capella</text>
      <text
        x="100" y="156" textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="9" letterSpacing="2" fill="#5a4f47"
      >{initials.toUpperCase()}</text>
      {/* Sparkle */}
      <circle cx="46" cy="80" r="3" fill={p.accent} opacity="0.4" />
      <circle cx="160" cy="60" r="2" fill={p.accent} opacity="0.5" />
      <circle cx="150" cy="190" r="4" fill={p.accent} opacity="0.25" />
    </svg>
  );
}
