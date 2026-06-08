"use client";

import Image from "next/image";
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
          className="fixed bottom-6 inset-e-6 z-50 flex items-center gap-2.5 rounded-(--radius-pill) bg-white px-3 py-3 text-brown shadow-[0_4px_20px_color-mix(in_oklch,var(--accent)_45%,transparent)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[oklch(0.44_0.14_38)] hover:shadow-[0_8px_28px_color-mix(in_oklch,var(--accent)_50%,transparent)] sm:px-5"
          style={{ animation: "ask-fab-in 500ms 600ms cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* Capella logo */}
          <Image
            src="/capella logo2.png"
            alt={dict.brand}
            width={400}
            height={100}
            className="h-5 w-auto object-contain"
          />
          <span className="font-(--font-display) italic text-base leading-none">{dict.ask.button}</span>
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
