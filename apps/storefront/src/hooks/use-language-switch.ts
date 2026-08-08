"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Language } from "@capella/shared";

/**
 * Swaps the locale segment of the current URL, keeping the page and its query
 * string intact so filters and searches survive the switch.
 */
export function useLanguageSwitch(lang: Language) {
  const router = useRouter();
  const pathname = usePathname();

  const switchLang = () => {
    const next: Language = lang === "ar" ? "en" : "ar";
    const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.push(`/${next}${rest === "/" ? "" : rest}${search}`);
  };

  return { switchLang };
}
