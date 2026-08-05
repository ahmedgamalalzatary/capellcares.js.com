"use client";

import { useEffect, useRef, useState } from "react";
import { getDict } from "@minikoshk/shared";
import { searchStorefront } from "@/lib/search";
import type {
  AskMinikoshkMessage,
  AskMinikoshkProps,
  AskMinikoshkResults
} from "@/types/ask-minikoshk.types";

const noResults: AskMinikoshkResults = {
  products: [],
  categories: [],
  offers: [],
  collections: []
};

export function useAskMinikoshk({ lang, onClose }: AskMinikoshkProps) {
  const dict = getDict(lang);
  const [messages, setMessages] = useState<AskMinikoshkMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (!pending && messages.at(-1)?.role === "assistant") {
      inputRef.current?.focus();
    }
  }, [messages, pending]);

  async function send() {
    const query = input.trim();
    if (!query || pending) return;

    setInput("");
    setPending(true);
    setMessages((previous) => [...previous, { role: "user", text: query }]);
    try {
      const results = await searchStorefront(query);
      setMessages((previous) => [...previous, { role: "assistant", query, results }]);
    } catch {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", query, results: noResults, error: true }
      ]);
    } finally {
      setPending(false);
    }
  }

  return {
    bottomRef,
    dict,
    input,
    inputRef,
    messages,
    pending,
    send,
    setInput
  };
}
