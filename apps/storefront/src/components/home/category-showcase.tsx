import Link from "next/link";
import type { Category, Dict, Language } from "@capella/shared";
import { SectionHeading } from "./section-heading";

// Rotating ground tints so the (image-less) category tiles stay lively.
const TINTS = [
  { bg: "var(--ink)", fg: "#ffffff", arrow: "var(--warm)" },
  { bg: "var(--warm)", fg: "var(--ink)", arrow: "var(--ink)" },
  { bg: "var(--accent-soft)", fg: "var(--ink)", arrow: "var(--ink)" },
  { bg: "#2f5a86", fg: "#ffffff", arrow: "var(--warm)" }
];

/** ZEE "Shop by Category" block — a tile grid of the top-level categories. */
export function CategoryShowcase({
  categories,
  lang,
  dict
}: {
  categories: Category[];
  lang: Language;
  dict: Dict;
}) {
  const top = categories.filter((c) => c.parentId === null).slice(0, 8);
  if (top.length === 0) return null;

  return (
    <section className="container" style={{ marginTop: 72 }}>
      <SectionHeading top={dict.shop.shopByCategoryTop} bottom={dict.shop.shopByCategoryBottom} />
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))" }}
      >
        {top.map((cat, i) => {
          const tint = TINTS[i % TINTS.length];
          const name = cat.name[lang] ?? cat.name.en;
          return (
            <Link
              key={cat.id}
              href={`/${lang}/category/${cat.slug}`}
              style={{
                background: tint.bg,
                color: tint.fg,
                borderRadius: "var(--radius-xl)",
                padding: "28px 24px",
                minHeight: 180,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "transform var(--motion) var(--ease-out-expo), box-shadow var(--motion) var(--ease-out-expo)"
              }}
              className="cat-tile"
            >
              <span className="eyebrow" style={{ color: tint.fg, opacity: 0.7 }}>
                {dict.nav.categories}
              </span>
              <span
                className="display"
                style={{
                  fontSize: "clamp(22px, 2.4vw, 30px)",
                  lineHeight: 1.05,
                  textTransform: "uppercase",
                  marginTop: 24
                }}
              >
                {name}
              </span>
              <span style={{ color: tint.arrow, fontSize: 13, fontWeight: 600, marginTop: 8 }}>
                {dict.shop.shopCategory.replace("{name}", name)} →
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
