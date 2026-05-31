"use client";

import { useEffect, useRef, useState } from "react";

export function FilterSection({
  label,
  children,
  defaultOpen = true,
  dark = false
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  dark?: boolean;
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

  const lineColor = dark ? "oklch(1 0 0 / 0.1)" : "var(--hairline)";
  const labelColor = dark ? "oklch(0.94 0.06 85 / 0.5)" : "var(--ink-3)";
  const chevronColor = dark ? "oklch(0.94 0.06 85 / 0.6)" : "var(--ink-3)";

  return (
    <div style={{ borderBottom: `1px solid ${lineColor}` }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 0",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "start"
        }}
        aria-expanded={open}
      >
        <span
          style={{
            fontSize: "10px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: labelColor
          }}
        >
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
          style={{
            transition: "transform 280ms cubic-bezier(0.16, 1, 0.3, 1)",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            flexShrink: 0
          }}
        >
          <path d="M2 4l3 3 3-3" />
        </svg>
      </button>

      <div
        ref={contentRef}
        style={{
          height: height === "auto" ? "auto" : `${height}px`,
          overflow: isAnimating || height === 0 ? "hidden" : "visible",
          transition: "height 280ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: isAnimating ? "height" : "auto"
        }}
      >
        <div style={{ paddingBottom: "16px" }}>{children}</div>
      </div>
    </div>
  );
}
