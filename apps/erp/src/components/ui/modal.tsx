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

  return (
    <div className="modal-overlay">
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="overlay-dismiss"
      />
      <div className={`modal modal--${size}`} role="dialog" aria-modal="true">
        <div className="modal__head">
          <h3>{title}</h3>
          <button onClick={onClose} aria-label="إغلاق" className="modal__close">
            <Icon.X />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
