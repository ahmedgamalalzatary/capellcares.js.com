"use client";

import { useState } from "react";
import { type Language, getDict } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
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
          className="fixed bottom-6 inset-e-6 z-50 flex items-center gap-2.5 rounded-(--radius-pill) border border-(--gold-line) bg-surface px-3 py-3 text-ink shadow-(--shadow-gold) transition-all duration-200 hover:-translate-y-0.5 hover:bg-(--warm-soft) sm:px-5"
          style={{ animation: "ask-fab-in 500ms 600ms cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {/* Eye of Horus mark */}
          <Icon.Eye size={26} className="text-(--gold-deep)" />
          <span className="font-(--font-display) text-base leading-none">{dict.ask.button}</span>
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
