"use client";

import type { ReactNode } from "react";
import { AskCapellaReplyContent } from "./ask-capella-results";
import { useAskCapella } from "./use-ask-capella";
import type { AskCapellaOverlayProps } from "./ask-capella.types";

export function AskCapellaOverlay({ lang, onClose }: AskCapellaOverlayProps) {
  const {
    avatarInitial,
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
        className="pointer-events-auto flex w-full max-w-400px flex-col overflow-hidden rounded-lg border border-(--hairline) bg-surface shadow-r(--shadow-2)"
        style={{ height: "min(600px, 88vh)", animation: "ask-slide-up 260ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-(--hairline) bg-linear-to-r from-accent to-[oklch(0.44_0.14_38)] px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/><circle cx="19" cy="5" r="3" fill="white" stroke="none"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-(--font-display) italic text-[16px] leading-none text-white">
              {dict.ask.assistantName}
            </p>
            <p className="mt-0.5 text-[11px] text-white/70">
              {dict.ask.assistant}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Welcome */}
          <CapellaBubble initial={avatarInitial}>
            <p className="text-[13.5px] leading-[1.65] text-(--ink-2)">
              {dict.ask.welcome}
            </p>
          </CapellaBubble>

          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <UserBubble key={i} text={msg.text} />
            ) : (
              <CapellaBubble key={i} initial={avatarInitial}>
                <AskCapellaReplyContent results={msg.results} query={msg.query} lang={lang} dict={dict} error={msg.error} errorMessage={msg.errorMessage} onClose={onClose} />
              </CapellaBubble>
            )
          )}

          {pending && (
            <CapellaBubble initial={avatarInitial}>
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
        <div className="shrink-0 border-t border-(--hairline) bg-canvas p-3">
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
              className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-(--ink-3) disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || pending}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-30"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {isAr ? <path d="M5 12h14M5 12l7-7M5 12l7 7"/> : <path d="M19 12H5M19 12l-7-7M19 12l-7 7"/>}
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
      <div className="max-w-[75%] rounded-[18px_18px_4px_18px] bg-accent px-4 py-2.5 text-[13.5px] leading-[1.6] text-white">
        {text}
      </div>
    </div>
  );
}

function CapellaBubble({ children, initial }: { children: ReactNode; initial: string }) {
  return (
    <div className="flex items-end gap-2" style={{ animation: "ask-bubble-in 180ms ease both" }}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-warm text-[11px] text-white font-bold">
        {initial}
      </div>
      <div className="max-w-[85%] rounded-[18px_18px_18px_4px] border border-(--hairline) bg-white px-4 py-3 shadow-(--shadow-1)">
        {children}
      </div>
    </div>
  );
}
