"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDict, languages, type Language } from "@minikoshk/shared";
import { useLocale } from "../i18n/LocaleProvider";
import { withLocale } from "@/lib/locale";

/** Toggles the storefront between the two configured languages. */
export function LangSwitcher({ className }: { className?: string }) {
  const { lang } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const target = (languages.find((candidate) => candidate !== lang) ?? lang) as Language;
  const targetPath = withLocale(pathname, target);

  return (
    <button
      type="button"
      onClick={() => {
        const query = searchParams.toString();
        const hash = window.location.hash;
        router.push(`${targetPath}${query ? `?${query}` : ""}${hash}`);
      }}
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
