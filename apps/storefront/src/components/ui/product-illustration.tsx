// Lightweight SVG placeholder shown until real photography is uploaded.
//
// Draws the thing Đespacito actually hands you: a lidded box with a band, the
// crossed-Đ monogram, and the product's initials. It replaced a cosmetics
// bottle labelled "Capella" — wrong brand, and the wrong object for a shop that
// sells chocolate, bakery, coffee, and nuts.
import Image from "next/image";
import type { Product } from "@capella/shared";

/** Tints drawn from the sampled brand palette, one per product line. */
const TINTS = {
  chocolate: { box: "#f6cdd1", band: "#a04552", mark: "#2a1f1c" },
  bakery: { box: "#f3ddc4", band: "#a8763f", mark: "#2a1f1c" },
  cafe: { box: "#ded1c6", band: "#5a4032", mark: "#2a1f1c" },
  nuts: { box: "#eddcc4", band: "#946b3f", mark: "#2a1f1c" },
  default: { box: "#f6cdd1", band: "#a04552", mark: "#2a1f1c" }
} as const;

/** Keyword match on the slug — the catalogue has no line field to key off. */
function pickTint(slug: string) {
  const s = slug.toLowerCase();
  if (/coffee|espresso|latte|drink|tea|cafe/.test(s)) return TINTS.cafe;
  if (/cake|croissant|pastry|bread|tart|bakery/.test(s)) return TINTS.bakery;
  if (/nut|almond|pistachio|cashew|apricot|date|dried|fruit/.test(s)) return TINTS.nuts;
  if (/chocolate|bon|praline|truffle|bar|gift/.test(s)) return TINTS.chocolate;
  return TINTS.default;
}

interface Props {
  product: Pick<Product, "slug" | "name" | "imagePath">;
  className?: string;
}

export function ProductIllustration({ product, className }: Props) {
  if (product.imagePath) {
    return (
      <Image
        className={className ?? "w-140 object-contain rounded-md"}
        src={product.imagePath}
        alt={product.name.en}
        width={800}
        height={1000}
        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 34vw, 78vw"
      />
    );
  }

  const t = pickTint(product.slug);
  const initials = product.name.en
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <svg
      className={className}
      viewBox="0 0 200 240"
      role="img"
      aria-label={product.name.en}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Box body */}
      <rect x="38" y="86" width="124" height="104" rx="6" fill={t.box} />
      {/* Lid */}
      <rect x="30" y="66" width="140" height="30" rx="6" fill={t.box} />
      <rect x="30" y="90" width="140" height="6" fill={t.band} opacity="0.16" />
      {/* Ribbon band down the front */}
      <rect x="90" y="96" width="20" height="94" fill={t.band} opacity="0.9" />
      <rect x="30" y="72" width="140" height="18" fill={t.band} opacity="0.9" />
      {/* The crossed Đ, on the lid band */}
      <text
        x="100"
        y="87"
        textAnchor="middle"
        fontFamily="Bodoni Moda, Didot, Georgia, serif"
        fontSize="15"
        fill="#f2efec"
      >
        Đ
      </text>
      {/* Product initials, embossed on the box front */}
      <text
        x="100"
        y="152"
        textAnchor="middle"
        fontFamily="Karla, ui-sans-serif, sans-serif"
        fontSize="13"
        fontWeight="700"
        letterSpacing="2"
        fill="#f2efec"
      >
        {initials}
      </text>
    </svg>
  );
}
