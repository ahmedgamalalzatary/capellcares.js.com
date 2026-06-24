import type { Offer } from "@capella/shared";

interface Props {
  offer: Pick<Offer, "slug" | "name" | "imagePath">;
  className?: string;
}

const palettes: Record<string, { a: string; b: string; ink: string }> = {
  "rose-ritual-bundle": { a: "#f6e3e5", b: "#dec8cb", ink: "#a13b4b" },
  "glow-routine": { a: "#fdebcb", b: "#efe1c2", ink: "#b58950" },
  "weekend-pamper": { a: "#e8d3b3", b: "#d6e8d4", ink: "#3e7a4d" }
};

export function OfferIllustration({ offer, className }: Props) {
  if (offer.imagePath) {
    return (
      <img
        className={className}
        src={offer.imagePath}
        alt={offer.name.en}
        loading="lazy"
      />
    );
  }

  const p = palettes[offer.slug] ?? { a: "#f1ece2", b: "#e6ddd0", ink: "#2a221c" };
  return (
    <svg className={className} viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={offer.name.en}>
      <defs>
        <linearGradient id={`og-${offer.slug}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={p.a} />
          <stop offset="100%" stopColor={p.b} />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#og-${offer.slug})`} />
      {/* three bottles */}
      <g transform="translate(60 50)">
        <rect width="40" height="110" rx="8" fill="#fff" stroke={p.ink} strokeWidth="1" />
        <rect x="10" y="-12" width="20" height="14" rx="3" fill={p.ink} />
      </g>
      <g transform="translate(140 30)">
        <rect width="40" height="130" rx="8" fill="#fff" stroke={p.ink} strokeWidth="1" />
        <rect x="10" y="-12" width="20" height="14" rx="3" fill={p.ink} />
      </g>
      <g transform="translate(220 60)">
        <rect width="40" height="100" rx="8" fill="#fff" stroke={p.ink} strokeWidth="1" />
        <rect x="10" y="-12" width="20" height="14" rx="3" fill={p.ink} />
      </g>
      <text x="160" y="190" textAnchor="middle" fill={p.ink} fontFamily="BallPill, NeueMontreal, sans-serif" fontSize="14" fontStyle="normal">
        Capella
      </text>
    </svg>
  );
}
