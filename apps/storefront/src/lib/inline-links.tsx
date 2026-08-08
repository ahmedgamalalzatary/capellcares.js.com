import type { ReactNode } from "react";
import Link from "next/link";
import type { Language } from "@capella/shared";

/**
 * Inline links inside dictionary prose, written markdown-style: `[label](/path)`.
 *
 * The long-form legal pages come from source documents where certain phrases —
 * "Help Center", "Privacy Policy", … — are styled as links. Marking them in the
 * copy itself keeps each occurrence deliberate: the same words appear elsewhere
 * as plain prose (the browser's own "Help" page, for one) and must stay plain.
 *
 * A target starting with `/` is a page on this site and is resolved against the
 * active locale; anything else is treated as third-party and opens in a new tab.
 */
const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

const LINK_CLASS =
  "font-semibold text-ink underline underline-offset-2 transition-colors hover:text-accent";

export function renderInlineLinks(text: string, lang: Language): ReactNode {
  const pattern = new RegExp(LINK_PATTERN.source, "g");
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const [full, label, href] = match;
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    // "/" is the locale home; anything deeper is appended as-is.
    const internalPath = href === "/" ? "" : href;

    nodes.push(
      href!.startsWith("/") ? (
        <Link key={`${match.index}-${href}`} href={`/${lang}${internalPath}`} className={LINK_CLASS}>
          {label}
        </Link>
      ) : (
        <a
          key={`${match.index}-${href}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {label}
        </a>
      )
    );

    lastIndex = match.index + full.length;
  }

  if (nodes.length === 0) return text;
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
