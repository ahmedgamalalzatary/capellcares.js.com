"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { AskCapellaReplyContent } from "./ask-capella-results";
import { useAskCapella } from "../../hooks/use-ask-capella";
import type { AskCapellaOverlayProps } from "../../types/ask-capella.types";

export function AskCapellaOverlay({ lang, onClose }: AskCapellaOverlayProps) {
  const {
    bottomRef,
    dict,
    input,
    inputRef,
    isAr,
    messages,
    pending,
    send,
    setInput
  } = useAskCapella({ lang, onClose });

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-end p-4 sm:p-6 pointer-events-none">
      <div
        className="pointer-events-auto flex w-72 max-w-[calc(100vw-2rem)] h-112 max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-lg border border-(--hairline) bg-surface shadow-(--shadow-2) sm:w-96 sm:h-144 sm:max-h-[calc(100dvh-3rem)]"
        style={{ animation: "ask-slide-up 260ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 bg-canvas px-5 py-4">
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
            <Image src="/capella logo2.png" alt="Capella" fill sizes="32px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#67645f]">
              {dict.ask.assistant}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#67645f] transition-colors hover:bg-black/5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Welcome */}
          <CapellaBubble>
            <p className="text-sm leading-[1.65] text-(--ink-2)">
              {dict.ask.welcome}
            </p>
          </CapellaBubble>

          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <UserBubble key={i} text={msg.text} />
            ) : (
              <CapellaBubble key={i}>
                <AskCapellaReplyContent results={msg.results} query={msg.query} lang={lang} dict={dict} error={msg.error} errorMessage={msg.errorMessage} onClose={onClose} />
              </CapellaBubble>
            )
          )}

          {pending && (
            <CapellaBubble>
              <div className="flex items-center gap-1.5 py-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-(--ink-3)"
                    style={{ animation: `ask-dot 1.2s ${i * 0.2}s ease-in-out infinite` }}
                  />
                ))}
              </div>
            </CapellaBubble>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 bg-canvas p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-center gap-2 rounded-(--radius-pill) border border-(--hairline) bg-surface px-4 py-2 transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--accent)_16%,transparent)]"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={dict.ask.typeMessage}
              disabled={pending}
              className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-(--ink-3) disabled:opacity-50 sm:text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || pending}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-30"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {isAr ? <path d="M5 12h14M5 12l7-7M5 12l7 7" /> : <path d="M19 12H5M19 12l-7-7M19 12l-7 7" />}
              </svg>
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes ask-slide-up {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ask-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes ask-bubble-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end" style={{ animation: "ask-bubble-in 180ms ease both" }}>
      <div className="max-w-[75%] rounded-[18px_18px_4px_18px] bg-accent px-4 py-2.5 text-sm leading-[1.6] text-white">
        {text}
      </div>
    </div>
  );
}

function CapellaBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-end gap-2" style={{ animation: "ask-bubble-in 180ms ease both" }}>
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full">
        <Image src="/capella logo2.png" alt="" fill sizes="28px" className="object-cover" />
      </div>
      <div className="max-w-[85%] rounded-[18px_18px_18px_4px] border border-(--hairline) bg-white px-4 py-3 shadow-(--shadow-1)">
        {children}
      </div>
    </div>
  );
}
