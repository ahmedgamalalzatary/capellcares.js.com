"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { API_BASE } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const SIZES = { sm: "size-9", md: "size-11", lg: "size-16", xl: "size-24" } as const;

/** Stored media may be a relative `/uploads/...` path, which resolves against the API origin. */
export function resolveMediaSrc(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/uploads/")) return `${API_BASE}${value}`;
  return value;
}

/**
 * The tray's signature: every item sits in a sunken well at one fixed scale.
 * Shows the image, else the item's initial, else a broken-image glyph when the file fails to load.
 */
export function Thumb({
  src,
  fallback,
  size = "md",
  className,
}: {
  src?: string | null;
  fallback?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      data-slot="thumb"
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-thumb bg-sunken text-text-muted shadow-inset",
        SIZES[size],
        className,
      )}
    >
      {showImage ? (
        <img src={resolveMediaSrc(src!)} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : failed ? (
        <ImageOff aria-hidden className="size-1/2 max-h-5 max-w-5 text-icon-faint" />
      ) : (
        <span aria-hidden className="font-num text-sm font-medium uppercase">{fallback ?? "?"}</span>
      )}
    </span>
  );
}
