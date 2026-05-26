"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { type Language, type Offer, type Category, pickLang, formatPrice, getDict } from "@capella/shared";
import { fetchProducts, fetchCategories, fetchOffers } from "@/lib/api/client";
import type { Product } from "@capella/shared";

interface Props {
  lang: Language;
  onClose: () => void;
}

interface Results {
  products: Product[];
  categories: Category[];
  offers: Offer[];
}

type Message =
  | { role: "user"; text: string }
  | { role: "capella"; results: Results; query: string };

const EMPTY_RESULTS: Results = { products: [], categories: [], offers: [] };

export function AskCapellaOverlay({ lang, onClose }: Props) {
  const dict = getDict(lang);
  const isAr = lang === "ar";
  const avatarInitial = dict.ask.assistantName.charAt(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function send() {
    const q = input.trim();
    if (!q || pending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);

    startTransition(async () => {
      const qLower = q.toLowerCase();
      const [products, allCategories, allOffers] = await Promise.all([
        fetchProducts({ q, lang }),
        fetchCategories({ lang }),
        fetchOffers({ lang })
      ]);
      const categories = allCategories
        .filter((c) => !c.deletedAt && pickLang(c.name, lang).toLowerCase().includes(qLower))
        .slice(0, 4);
      const offers = allOffers
        .filter((o) => !o.deletedAt && o.status === "active" && pickLang(o.name, lang).toLowerCase().includes(qLower))
        .slice(0, 3);
      const results: Results = { products: products.slice(0, 5), categories, offers };
      setMessages((prev) => [...prev, { role: "capella", results, query: q }]);
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end p-4 sm:p-6 pointer-events-none">
      <div
        className="pointer-events-auto flex w-full max-w-[400px] flex-col overflow-hidden rounded-(--radius-lg) border border-(--hairline) bg-(--surface) shadow-[var(--shadow-2)]"
        style={{ height: "min(600px, 88vh)", animation: "ask-slide-up 260ms cubic-bezier(0.16,1,0.3,1) both" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-(--hairline) bg-gradient-to-r from-(--accent) to-[oklch(0.44_0.14_38)] px-5 py-4">
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
                <ReplyContent results={msg.results} query={msg.query} lang={lang} dict={dict} onClose={onClose} />
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
        <div className="shrink-0 border-t border-(--hairline) bg-(--canvas) p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-center gap-2 rounded-(--radius-pill) border border-(--hairline) bg-(--surface) px-4 py-2 transition-[border-color,box-shadow] focus-within:border-(--accent) focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--accent)_16%,transparent)]"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={dict.ask.typeMessage}
              disabled={pending}
              className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-(--ink) outline-none placeholder:text-(--ink-3) disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || pending}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--accent) text-white transition-opacity disabled:opacity-30"
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
      <div className="max-w-[75%] rounded-[18px_18px_4px_18px] bg-(--accent) px-4 py-2.5 text-[13.5px] leading-[1.6] text-white">
        {text}
      </div>
    </div>
  );
}

function CapellaBubble({ children, initial }: { children: React.ReactNode; isAr?: boolean; initial: string }) {
  return (
    <div className="flex items-end gap-2" style={{ animation: "ask-bubble-in 180ms ease both" }}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-(--accent) to-(--warm) text-[11px] text-white font-bold">
        {initial}
      </div>
      <div className="max-w-[85%] rounded-[18px_18px_18px_4px] border border-(--hairline) bg-white px-4 py-3 shadow-[var(--shadow-1)]">
        {children}
      </div>
    </div>
  );
}

function ReplyContent({
  results, query, lang, dict, onClose
}: {
  results: Results;
  query: string;
  lang: Language;
  dict: ReturnType<typeof getDict>;
  onClose: () => void;
}) {
  const isAr = lang === "ar";
  const hasResults = results.products.length > 0 || results.categories.length > 0 || results.offers.length > 0;

  if (!hasResults) {
    return (
      <div className="text-[13.5px] leading-[1.65]">
        <p className="text-(--ink-2)">
          {dict.ask.noResults.replace("{query}", query)}
        </p>
        <Link
          href={`/${lang}/products`}
          onClick={onClose}
          className="mt-2 inline-block font-(--font-display) italic text-[14px] text-(--accent) underline-offset-4 hover:underline"
        >
          {dict.ask.browseAll}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <p className="text-(--ink-2) leading-[1.6]">
        {dict.ask.found}
      </p>

      {results.products.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--ink-3)">{dict.ask.sections.products}</p>
          {results.products.map((p) => (
            <Link
              key={p.id}
              href={`/${lang}/products/${p.slug}`}
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-(--radius) p-1.5 transition-colors hover:bg-(--warm-soft)"
            >
              <div className="h-9 w-9 shrink-0 rounded-(--radius) border border-(--hairline) bg-[radial-gradient(circle,var(--warm-soft),var(--surface))]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-(--ink)">{pickLang(p.name, lang)}</p>
                <p className="text-[11px] text-(--ink-3)">{formatPrice(p.variants[0]?.price ?? 0, lang)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {results.categories.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--ink-3)">{dict.ask.sections.categories}</p>
          <div className="flex flex-wrap gap-1.5">
            {results.categories.map((c) => (
              <Link
                key={c.id}
                href={`/${lang}/category/${c.slug}`}
                onClick={onClose}
                className="rounded-(--radius-pill) border border-(--hairline) bg-(--canvas) px-3 py-1 text-[12px] text-(--ink-2) transition-colors hover:border-(--warm) hover:bg-(--warm-soft)"
              >
                {pickLang(c.name, lang)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {results.offers.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--ink-3)">{dict.ask.sections.offers}</p>
          {results.offers.map((o) => {
            const savings = o.originalTotal - o.price;
            return (
              <Link
                key={o.id}
                href={`/${lang}/offers/${o.slug}`}
                onClick={onClose}
                className="flex items-center justify-between gap-2 rounded-(--radius) p-1.5 transition-colors hover:bg-(--warm-soft)"
              >
                <span className="truncate text-(--ink)">{pickLang(o.name, lang)}</span>
                {savings > 0 && (
                  <span className="chip chip--accent shrink-0 text-[10px]">
                    {dict.offers.save.replace("{amount}", formatPrice(savings, lang))}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
