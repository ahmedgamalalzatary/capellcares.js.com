"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function FilterSection({
  label,
  children,
  defaultOpen = true
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(defaultOpen ? "auto" : 0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!contentRef.current) return;
    let rafId1 = 0;
    let rafId2 = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (open) {
      const nextHeight = contentRef.current.scrollHeight;
      setHeight(nextHeight);
      setIsAnimating(true);
      timeoutId = setTimeout(() => {
        setHeight("auto");
        setIsAnimating(false);
      }, 280);
    } else {
      const nextHeight = contentRef.current.scrollHeight;
      setHeight(nextHeight);
      rafId1 = requestAnimationFrame(() => {
        rafId2 = requestAnimationFrame(() => {
          setHeight(0);
          setIsAnimating(true);
          timeoutId = setTimeout(() => setIsAnimating(false), 280);
        });
      });
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
    };
  }, [open]);

  const chevronColor = "var(--ink-3)";

  return (
    <div className="border-b border-(--hairline)">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent py-[14px] text-start"
        aria-expanded={open}
      >
        <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-(--ink-3)">
          {label}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke={chevronColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          className={cn(
            "shrink-0 transition-transform duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "rotate-0" : "-rotate-90"
          )}
        >
          <path d="M2 4l3 3 3-3" />
        </svg>
      </button>

      <div
        ref={contentRef}
        // The panel height is measured from content, so it travels as a custom
        // property that the height utility below reads.
        style={{ "--filter-height": height === "auto" ? "auto" : `${height}px` } as CSSProperties}
        className={cn(
          "h-(--filter-height) transition-[height] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          isAnimating || height === 0 ? "overflow-hidden" : "overflow-visible",
          isAnimating ? "will-change-[height]" : "will-change-auto"
        )}
      >
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}
