"use client";

import { usePathname, useRouter } from "next/navigation";
import { getDict, languages, type Language } from "@minikoshk/shared";
import { useLocale } from "../i18n/LocaleProvider";
import { withLocale } from "@/lib/locale";

/** Toggles the storefront between the two configured languages. */
export function LangSwitcher({ className }: { className?: string }) {
  const { lang } = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const target = (languages.find((candidate) => candidate !== lang) ?? lang) as Language;

  return (
    <button
      type="button"
      onClick={() => router.push(withLocale(pathname, target))}
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
