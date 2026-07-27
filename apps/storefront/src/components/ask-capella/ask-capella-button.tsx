"use client";

import { useState } from "react";
import { type Language, getDict } from "@capella/shared";
import { AskCapellaOverlay } from "./ask-capella-overlay";

interface Props {
  lang: Language;
}

export function AskCapellaButton({ lang }: Props) {
  const [open, setOpen] = useState(false);
  const dict = getDict(lang);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={dict.ask.button}
          className="fixed bottom-6 inset-e-6 z-50 flex items-center gap-2.5 rounded-(--radius-pill) bg-surface px-3 py-3 text-ink shadow-(--shadow-glow) transition-all duration-200 hover:-translate-y-0.5 hover:bg-blush-pale hover:shadow-(--shadow-2) sm:px-5"
          style={{ animation: "ask-fab-in 500ms 600ms cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* The crossed Đ — the one glyph nobody else's logo has. Replaces a
              raster logo file that is no longer in public/. */}
          <span
            aria-hidden
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-deep font-(--font-display) text-sm leading-none text-paper-hi"
          >
            Đ
          </span>
          <span className="text-base font-semibold leading-none">{dict.ask.button}</span>
        </button>
      )}

      {open && <AskCapellaOverlay lang={lang} onClose={() => setOpen(false)} />}

      <style>{`
        @keyframes ask-fab-in {
          from { opacity: 0; transform: translateY(16px) scale(0.88); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
