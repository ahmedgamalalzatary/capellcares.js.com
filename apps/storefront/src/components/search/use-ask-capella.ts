"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getDict, pickLang } from "@capella/shared";
import { fetchCategories, fetchOffers, fetchProducts } from "@/lib/api/client";
import type {
  AskCapellaMessage,
  AskCapellaOverlayProps,
  AskCapellaResults
} from "./ask-capella.types";

export function useAskCapella({ lang, onClose }: AskCapellaOverlayProps) {
  const dict = getDict(lang);
  const isAr = lang === "ar";
  const avatarInitial = dict.ask.assistantName.charAt(0);
  const [messages, setMessages] = useState<AskCapellaMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function send() {
    const query = input.trim();
    if (!query || pending) {
      return;
    }

    setInput("");
    setMessages((previous) => [...previous, { role: "user", text: query }]);

    startTransition(async () => {
      try {
        const queryLower = query.toLowerCase();
        const [products, allCategories, allOffers] = await Promise.all([
          fetchProducts({ q: query, lang }),
          fetchCategories({ lang }),
          fetchOffers({ lang })
        ]);
        const categories = allCategories
          .filter((category) => !category.deletedAt && pickLang(category.name, lang).toLowerCase().includes(queryLower))
          .slice(0, 4);
        const offers = allOffers
          .filter((offer) => !offer.deletedAt && offer.status === "active" && pickLang(offer.name, lang).toLowerCase().includes(queryLower))
          .slice(0, 3);
        const results: AskCapellaResults = {
          products: products.slice(0, 5),
          categories,
          offers
        };

        setMessages((previous) => [...previous, { role: "capella", results, query }]);
      } catch {
        // Network/fetch failure: respond with an empty result set instead of leaving the query hanging.
        const results: AskCapellaResults = { products: [], categories: [], offers: [] };
        setMessages((previous) => [...previous, { role: "capella", results, query }]);
      }
    });
  }

  return {
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
  };
}
