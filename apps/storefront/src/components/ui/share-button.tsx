"use client";

import { useState } from "react";

interface Props {
  /** Site-relative path of the page being shared, e.g. `/en/products/rose-serum`. */
  path: string;
  /** Title handed to the native share sheet. */
  title: string;
  dict: any;
  className?: string;
}

/**
 * Share control shared by every detail page. Uses the Web Share API when the
 * browser exposes one and falls back to copying the link with a short toast.
 */
export function ShareButton({ path, title, dict, className }: Props) {
  const [linkCopied, setLinkCopied] = useState(false);

  const onShare = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      // clipboard write failed; nothing more we can do
    }
  };

  return (
    <div className="relative grid">
      <button type="button" className={["btn btn--soft", className].filter(Boolean).join(" ")} onClick={onShare}>
        {dict.common.share}
      </button>
      {linkCopied && (
        <div className="pointer-events-none absolute -top-9 inset-x-0 flex justify-center">
          <span
            role="status"
            className="whitespace-nowrap rounded-(--radius-pill) bg-ink px-3 py-1.5 text-xs font-medium text-canvas"
          >
            {dict.common.linkCopied}
          </span>
        </div>
      )}
    </div>
  );
}
