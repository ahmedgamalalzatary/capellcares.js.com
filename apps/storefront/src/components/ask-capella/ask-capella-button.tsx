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
          className="fixed bottom-4 inset-e-4 z-50 flex items-center gap-2.5 rounded-(--radius-pill) bg-white px-3 py-3 text-brown shadow-[0_4px_20px_color-mix(in_oklch,var(--accent)_45%,transparent)] transition-all duration-200 animate-[ask-fab-in_500ms_600ms_cubic-bezier(0.16,1,0.3,1)_both] hover:-translate-y-0.5 hover:bg-[#f1f0ed] hover:shadow-[0_8px_28px_color-mix(in_oklch,var(--accent)_50%,transparent)] sm:bottom-6 sm:inset-e-6 sm:px-5"
        >
          {/* Capella logo */}
          <Image
            src="/capella logo2.png"
            alt={dict.brand}
            width={400}
            height={100}
            className="h-5 w-auto object-contain"
          />
          <span className="font-(--font-display) text-base leading-none">{dict.ask.button}</span>
        </button>
      )}

      {open && <AskCapellaOverlay lang={lang} onClose={() => setOpen(false)} />}
    </>
  );
}
