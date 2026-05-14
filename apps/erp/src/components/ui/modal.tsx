"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "./icons";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({ open, title, onClose, footer, children, size = "md" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const maxWidth = size === "sm" ? 380 : size === "lg" ? 720 : 480;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth }} role="dialog" aria-modal="true">
        <div className="modal__head">
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} aria-label="إغلاق" style={{ background: "transparent", border: 0, padding: 6, color: "var(--ink-3)" }}>
            <Icon.X />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
