import Link from "next/link";
import type { Language } from "@capella/shared";

/**
 * ZEE-style stacked section heading: a small lead word sitting above an
 * oversized display word, with an optional "view all" link on the right.
 */
export function SectionHeading({
  top,
  bottom,
  description,
  href,
  cta,
  align = "start"
}: {
  top: string;
  bottom: string;
  description?: string;
  href?: string;
  cta?: string;
  align?: "start" | "center";
}) {
  return (
    <div
      className="row row--between"
      style={{
        alignItems: "flex-end",
        marginBottom: 28,
        gap: 16,
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "space-between",
        textAlign: align === "center" ? "center" : "start"
      }}
    >
      <div className="stack" style={{ gap: 2 }}>
        <span
          className="eyebrow"
          style={{ color: "var(--accent)", opacity: 1, marginInlineStart: 4 }}
        >
          {top}
        </span>
        <h2
          className="display"
          style={{
            margin: 0,
            fontSize: "clamp(34px, 6vw, 72px)",
            lineHeight: 0.95,
            color: "var(--ink)",
            textTransform: "uppercase"
          }}
        >
          {bottom}
        </h2>
        {description ? (
          <p className="muted" style={{ margin: "8px 0 0", maxWidth: "52ch", fontSize: 15 }}>
            {description}
          </p>
        ) : null}
      </div>
      {href && cta ? (
        <Link href={href} className="btn btn--ghost btn--sm">
          {cta}
        </Link>
      ) : null}
    </div>
  );
}

export type { Language };
