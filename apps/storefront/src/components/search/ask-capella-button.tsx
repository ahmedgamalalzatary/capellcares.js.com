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
          className="fixed bottom-6 end-6 z-50 flex items-center gap-2.5 rounded-(--radius-pill) bg-(--accent) px-3 py-3 text-white shadow-[0_4px_20px_color-mix(in_oklch,var(--accent)_45%,transparent)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[oklch(0.44_0.14_38)] hover:shadow-[0_8px_28px_color-mix(in_oklch,var(--accent)_50%,transparent)] sm:px-5"
          style={{ animation: "ask-fab-in 500ms 600ms cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* Chat bubble icon */}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="hidden font-(--font-display) italic text-[15px] leading-none sm:inline">{dict.ask.button}</span>
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
