"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icons";

const VIEWPORT_MARGIN = 8;

/**
 * A single "⋯" trigger that reveals a dropdown of row actions (edit, delete, …).
 *
 * The dropdown is rendered in a portal with fixed positioning so it is never
 * clipped by an ancestor's `overflow: hidden` (e.g. the collapsible subtree) or
 * painted under a following row. Its position is clamped to the viewport so it
 * never spills off-screen. Closes on outside click, Escape, scroll/resize, or
 * after any item inside is clicked.
 */
export function RowMenu({ label = "إجراءات", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Measure the trigger and the (already-mounted) dropdown, then clamp into view.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !dropdownRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = dropdownRef.current.getBoundingClientRect();

    // RTL default: align the dropdown's right edge with the trigger's right edge.
    let left = trigger.right - menu.width;
    const maxLeft = window.innerWidth - menu.width - VIEWPORT_MARGIN;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, maxLeft));

    // Default below the trigger; flip above if it would overflow the bottom.
    let top = trigger.bottom + 4;
    if (top + menu.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = Math.max(VIEWPORT_MARGIN, trigger.top - 4 - menu.height);
    }

    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const close = () => setOpen(false);

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    setPosition(null);
    setOpen((value) => !value);
  };

  return (
    <div className="row-menu">
      <button
        ref={triggerRef}
        type="button"
        className="btn btn--ghost btn--sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={toggle}
      >
        <Icon.More />
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            className="row-menu__dropdown"
            role="menu"
            style={{
              position: "fixed",
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              // Hide until measured/clamped to avoid a one-frame jump.
              visibility: position ? "visible" : "hidden"
            }}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}
