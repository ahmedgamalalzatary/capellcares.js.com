"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDict, languages, type Language } from "@minikoshk/shared";
import { useLocale } from "../i18n/LocaleProvider";
import { withLocale } from "@/lib/locale";

/** Navigates to the current page in another locale, keeping the query and hash. */
function useSwitchLocale() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  return (target: Language) => {
    const query = searchParams.toString();
    const hash = window.location.hash;
    router.push(`${withLocale(pathname, target)}${query ? `?${query}` : ""}${hash}`);
  };
}

/** Toggles the storefront between the two configured languages. */
export function LangSwitcher({ className }: { className?: string }) {
  const { lang } = useLocale();
  const switchLocale = useSwitchLocale();

  const target = (languages.find((candidate) => candidate !== lang) ?? lang) as Language;

  return (
    <button
      type="button"
      onClick={() => switchLocale(target)}
      aria-label={getDict(target).langSwitch[target]}
      className={
        className ??
        "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full border border-gray-300 px-2 text-xs font-bold text-navy transition hover:border-brand-red hover:text-brand-red"
      }
    >
      {getDict(target).langSwitch.short}
    </button>
  );
}

/**
 * Both languages side by side as a segmented control, with a thumb that slides
 * to the active one. Used in the mobile drawer, where there is room to show the
 * choice rather than a single toggle. `inset-inline-start` keeps the thumb on
 * the correct side in RTL without any direction branching.
 */
export function LangOptions({ className }: { className?: string }) {
  const { lang } = useLocale();
  const switchLocale = useSwitchLocale();

  const activeIndex = languages.findIndex((candidate) => candidate === lang);

  return (
    <div
      role="radiogroup"
      aria-label={getDict(lang).header.language}
      className={`relative flex w-full max-w-xs rounded-full bg-search-bg p-1 ${className ?? ""}`}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 w-[calc(50%_-_0.25rem)] rounded-full bg-navy transition-[inset-inline-start] duration-200 ease-out"
        // 0.25rem is the track padding; the second option starts exactly at the
        // midpoint because the thumb is half the padded track wide.
        style={{ insetInlineStart: activeIndex <= 0 ? "0.25rem" : "50%" }}
      />
      {languages.map((candidate) => {
        const active = candidate === lang;
        return (
          <button
            key={candidate}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => switchLocale(candidate)}
            className={`relative z-10 flex-1 cursor-pointer rounded-full py-2 text-center text-xs font-bold transition-colors duration-200 ${
              active ? "text-white" : "text-navy"
            }`}
          >
            {getDict(candidate).langSwitch[candidate]}
          </button>
        );
      })}
    </div>
  );
}
