import type { Language } from "@minikoshk/shared";

/** Locale-aware "1,234 EGP" / "١٬٢٣٤ ج.م" price formatting used across the storefront. */
export function formatPrice(amount: number, lang: Language, currency: string): string {
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  return `${new Intl.NumberFormat(locale).format(amount)} ${currency}`;
}
