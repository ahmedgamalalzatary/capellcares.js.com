import Link from "next/link";
import type { Dict, Language } from "@capella/shared";

export function PromoBanner({ lang, dict }: { lang: Language; dict: Dict }) {
  return (
    <section className="container" style={{ marginTop: 64, marginBottom: 24 }}>
      <div
        style={{
          background: "var(--warm)",
          color: "var(--ink)",
          borderRadius: "var(--radius-xl)",
          padding: "48px 32px",
          display: "grid",
          gap: 16,
          justifyItems: "center",
          textAlign: "center"
        }}
      >
        <span className="eyebrow" style={{ opacity: 1 }}>#MakeMoves</span>
        <h2 className="display" style={{ margin: 0, fontSize: "clamp(28px, 4.5vw, 52px)", lineHeight: 1.05 }}>
          {dict.footer.newsletterTitle}
        </h2>
        <p style={{ margin: 0, maxWidth: "48ch", fontSize: 16 }}>{dict.footer.newsletterSubtitle}</p>
        <Link href={`/${lang}/signup`} className="btn btn--primary btn--lg" style={{ marginTop: 8 }}>
          {dict.footer.subscribe}
        </Link>
      </div>
    </section>
  );
}
