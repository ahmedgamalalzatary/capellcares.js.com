import Link from "next/link";
import type { Dict, Language } from "@capella/shared";

export function Hero({ lang, dict }: { lang: Language; dict: Dict }) {
  return (
    <section
      className="hero-zee"
      style={{
        background: "var(--ink)",
        color: "#fff",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        marginTop: 24
      }}
    >
      <div
        className="container"
        style={{
          display: "grid",
          gap: 28,
          padding: "72px 24px 80px",
          maxWidth: 860,
          textAlign: "center",
          justifyItems: "center"
        }}
      >
        <span className="eyebrow" style={{ color: "var(--warm)", opacity: 1 }}>
          {dict.shop.eyebrow}
        </span>
        <h1
          className="display"
          style={{
            margin: 0,
            fontSize: "clamp(40px, 7vw, 92px)",
            lineHeight: 1.02,
            color: "#fff",
            maxWidth: "16ch"
          }}
        >
          {dict.shop.heading}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 17, maxWidth: "52ch", margin: 0 }}>
          {dict.shop.description}
        </p>
        <div className="row" style={{ gap: 12, marginTop: 8 }}>
          <Link href={`/${lang}/products`} className="btn btn--gold btn--lg">
            {dict.nav.allProducts}
          </Link>
          <Link
            href={`/${lang}/collections`}
            className="btn btn--ghost btn--lg"
            style={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}
          >
            {dict.nav.collections}
          </Link>
        </div>
      </div>
    </section>
  );
}
