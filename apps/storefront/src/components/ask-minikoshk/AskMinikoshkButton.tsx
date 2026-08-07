"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getDict, type Language } from "@minikoshk/shared";
import { AskMinikoshkOverlay } from "./AskMinikoshkOverlay";

export function AskMinikoshkButton({ lang }: { lang: Language }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const dict = getDict(lang);

  useEffect(() => {
    if (wasOpen.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={dict.ask.button}
          // Sits above the mobile bottom tab bar; drops back to the corner from `lg`, where that bar is hidden.
          className="fixed bottom-20 right-4 z-40 flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-3 text-sm font-semibold text-brand-dark shadow-[0_5px_24px_rgba(53,58,63,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(53,58,63,0.34)] lg:bottom-6 lg:right-6 lg:px-4"
        >
          <Image src="/_logo-1.png" alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" aria-hidden="true" />
          <span>{dict.ask.button}</span>
        </button>
      )}
      {open && <AskMinikoshkOverlay lang={lang} onClose={() => setOpen(false)} />}
    </>
  );
}
