"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getDict } from "@capella/shared";
import {
  EMPTY_STOREFRONT_SEARCH_RESULTS,
  searchStorefront
} from "@/lib/storefront-search";
import type {
  AskCapellaMessage,
  AskCapellaOverlayProps,
  AskCapellaResults
} from "../types/ask-capella.types";

// The overlay unmounts whenever it closes — including when a result link is
// clicked — so the conversation cannot live only in component state or it is
// wiped the moment the customer opens something we found for them. Parking it in
// sessionStorage keeps the thread for the tab: close the panel, browse the
// product, reopen, and the search is still there. It is deliberately session
// scoped (not localStorage): the thread is a browsing aid, not something to
// resurrect days later, and queries can be personal.
const CONVERSATION_KEY = "capella:ask:v1";
const MAX_STORED_MESSAGES = 20;

function loadConversation(): AskCapellaMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(CONVERSATION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as AskCapellaMessage[]) : [];
  } catch {
    // Unparsable or storage blocked (private mode / disabled cookies): the chat
    // still works, it just starts empty.
    return [];
  }
}

function saveConversation(messages: AskCapellaMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CONVERSATION_KEY,
      JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))
    );
  } catch {
    // Over quota or storage blocked — nothing to do, the in-memory thread is fine.
  }
}

export function useAskCapella({ lang, onClose }: AskCapellaOverlayProps) {
  const dict = getDict(lang);
  const isAr = lang === "ar";
  // Starts empty and fills in after mount: reading storage during render would
  // make the server and client markup disagree and trip hydration.
  const [messages, setMessages] = useState<AskCapellaMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const restored = useRef(false);

  useEffect(() => {
    const stored = loadConversation();
    restored.current = true;
    if (stored.length > 0) setMessages(stored);
  }, []);

  useEffect(() => {
    // Don't let the empty first render overwrite a stored thread.
    if (!restored.current) return;
    saveConversation(messages);
  }, [messages]);

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
        const results = await searchStorefront(query, lang);

        startTransition(() => {
          setMessages((previous) => [...previous, { role: "capella", results, query }]);
        });
      } catch {
        const results: AskCapellaResults = EMPTY_STOREFRONT_SEARCH_RESULTS;
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
