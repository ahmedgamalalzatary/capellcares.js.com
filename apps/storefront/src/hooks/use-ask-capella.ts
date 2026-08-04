"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getDict } from "@capella/shared";
import { fetchCategories, fetchCollections, fetchOffers, fetchProducts } from "@/lib/api/client";
import type {
  AskCapellaMessage,
  AskCapellaOverlayProps,
  AskCapellaResults
} from "../types/ask-capella.types";

// Categories, offers, and collections are matched by name in BOTH languages
// (these have no keyword field), so a query in either language finds them
// regardless of the active store language.
function matchesBilingual(name: { ar: string; en: string }, queryLower: string) {
  return name.ar.toLowerCase().includes(queryLower) || name.en.toLowerCase().includes(queryLower);
}

export function useAskCapella({ lang, onClose }: AskCapellaOverlayProps) {
  const dict = getDict(lang);
  const isAr = lang === "ar";
  const [messages, setMessages] = useState<AskCapellaMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Autofocus only on devices with a fine pointer (mouse/trackpad). On touch
  // devices, focusing on open would instantly raise the on-screen keyboard
  // before the user has read anything — let them tap the field themselves.
  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
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

  // The field is disabled while Capella answers, and a browser drops focus
  // from an element it disables — leaving the user to click back in before
  // every follow-up question. Once an answer lands, put focus back.
  // Only an answer qualifies: the user's own message renders first, and
  // focusing then would pull focus off the send button they just tapped and
  // raise the keyboard over the reply they are waiting for. That also leaves
  // the deliberate touch-device behaviour above intact when the overlay opens.
  useEffect(() => {
    if (pending || messages[messages.length - 1]?.role !== "capella") {
      return;
    }
    inputRef.current?.focus();
  }, [messages, pending]);

  function send() {
    const query = input.trim();
    if (!query || pending) {
      return;
    }

    setInput("");
    setMessages((previous) => [...previous, { role: "user", text: query }]);

    void (async () => {
      try {
        const queryLower = query.toLowerCase();
        const [products, allCategories, allOffers, allCollections] = await Promise.all([
          fetchProducts({ q: query, lang, throwOnError: true }),
          fetchCategories({ lang, throwOnError: true }),
          fetchOffers({ lang, throwOnError: true }),
          fetchCollections({ lang, throwOnError: true })
        ]);
        const categories = allCategories
          .filter((category) => !category.deletedAt && matchesBilingual(category.name, queryLower))
          .slice(0, 4);
        const offers = allOffers
          .filter((offer) => !offer.deletedAt && offer.status === "active" && matchesBilingual(offer.name, queryLower))
          .slice(0, 3);
        const collections = allCollections
          .filter(
            (collection) =>
              !collection.deletedAt &&
              collection.status === "active" &&
              collection.visibility === "visible" &&
              matchesBilingual(collection.name, queryLower)
          )
          .slice(0, 3);
        const results: AskCapellaResults = {
          products: products.slice(0, 5),
          categories,
          offers,
          collections
        };

        startTransition(() => {
          setMessages((previous) => [...previous, { role: "capella", results, query }]);
        });
      } catch {
        const results: AskCapellaResults = { products: [], categories: [], offers: [], collections: [] };
        startTransition(() => {
          setMessages((previous) => [...previous, {
            role: "capella",
            results,
            query,
            error: true,
            errorMessage: isAr ? "حدث خطأ مؤقت. حاولي مرة أخرى." : "Temporary error. Please try again."
          }]);
        });
      }
    })();
  }

  return {
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
