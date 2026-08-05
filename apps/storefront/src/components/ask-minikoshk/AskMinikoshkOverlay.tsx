"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { useAskMinikoshk } from "@/hooks/useAskMinikoshk";
import type { AskMinikoshkProps } from "@/types/ask-minikoshk.types";
import { AskMinikoshkResults } from "./AskMinikoshkResults";

const dotDelays = [0, 150, 300];

export function AskMinikoshkOverlay({ lang, onClose }: AskMinikoshkProps) {
  const { bottomRef, dict, input, inputRef, messages, pending, send, setInput } =
    useAskMinikoshk({ lang, onClose });

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-end p-3 sm:p-6">
      <section
        role="dialog"
        aria-label={dict.ask.assistant}
        className="pointer-events-auto flex h-[min(36rem,calc(100dvh-1.5rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.22)] motion-safe:animate-[ask-minikoshk-slide-up_240ms_cubic-bezier(0.16,1,0.3,1)_both] sm:h-[36rem]"
      >
        <header className="flex shrink-0 items-center gap-3 bg-[#f2f2f2] px-4 py-3.5">
          <AssistantIcon />
          <h2 className="min-w-0 flex-1 text-sm font-semibold text-brand-dark">{dict.ask.assistant}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.ask.close}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-500 transition hover:bg-black/5 hover:text-brand-dark"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4" aria-live="polite">
          <AssistantBubble><p className="text-sm leading-6">{dict.ask.welcome}</p></AssistantBubble>
          {messages.map((message, index) => message.role === "user" ? (
            <div key={index} className="flex justify-end">
              <p className="max-w-[78%] rounded-[18px_18px_5px_18px] bg-brand-dark px-4 py-2.5 text-sm leading-6 text-white rtl:rounded-[18px_18px_18px_5px]">
                {message.text}
              </p>
            </div>
          ) : (
            <AssistantBubble key={index}>
              <AskMinikoshkResults
                results={message.results}
                query={message.query}
                lang={lang}
                dict={dict}
                error={message.error}
                onClose={onClose}
              />
            </AssistantBubble>
          ))}
          {pending && (
            <AssistantBubble>
              <span role="status" aria-label={dict.ask.searching} className="flex items-center gap-1.5 py-1">
                {dotDelays.map((delay) => (
                  <span key={delay} className="h-2 w-2 rounded-full bg-gray-400 motion-safe:animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </span>
            </AssistantBubble>
          )}
          <div ref={bottomRef} />
        </div>

        <footer className="shrink-0 border-t border-gray-100 bg-[#f2f2f2] p-3">
          <form
            onSubmit={(event) => { event.preventDefault(); void send(); }}
            className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 shadow-sm focus-within:border-brand-red focus-within:ring-2 focus-within:ring-brand-red/15"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={dict.ask.typeMessage}
              aria-label={dict.ask.typeMessage}
              disabled={pending}
              className="min-w-0 flex-1 border-0 bg-transparent px-1 text-base text-brand-dark outline-none placeholder:text-gray-400 disabled:opacity-50 sm:text-sm"
            />
            <button
              type="submit"
              aria-label={dict.ask.send}
              disabled={!input.trim() || pending}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-red text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <SearchIcon className="h-4 w-4" />
            </button>
          </form>
        </footer>
      </section>
    </div>
  );
}

function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <AssistantIcon small />
      <div className="max-w-[86%] rounded-[18px_18px_18px_5px] border border-gray-200 bg-white px-4 py-3 text-brand-dark shadow-sm rtl:rounded-[18px_18px_5px_18px]">
        {children}
      </div>
    </div>
  );
}

function AssistantIcon({ small = false }: { small?: boolean }) {
  return (
    <span className={`shrink-0 overflow-hidden rounded-full bg-white ${small ? "h-7 w-7" : "h-8 w-8"}`} aria-hidden="true">
      <Image src="/_logo-1.png" alt="" width={32} height={32} className="h-full w-full object-cover" />
    </span>
  );
}
