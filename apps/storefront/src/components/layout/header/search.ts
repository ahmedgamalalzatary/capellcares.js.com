"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Language } from "@capella/shared";

export function useHeaderSearch(lang: Language) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paramQ = searchParams.get("q") || "";

  const switchLang = () => {
    const next: Language = lang === "ar" ? "en" : "ar";
    const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.push(`/${next}${rest === "/" ? "" : rest}${search}`);
  };

  const navigateToSearch = (value: string, replace: boolean) => {
    const params = new URLSearchParams();
    const trimmed = value.trim();
    if (trimmed) params.set("q", trimmed);
    const qs = params.toString();
    const href = `/${lang}/products${qs ? `?${qs}` : ""}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href);
  };

  const onSearchInput = (value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigateToSearch(value, true), 250);
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigateToSearch(q, false);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    if (paramQ !== q) {
      setQ(paramQ);
    }
  }, [paramQ, q]);

  return {
    q,
    setQ,
    switchLang,
    onSearchInput,
    onSearch
  };
}
