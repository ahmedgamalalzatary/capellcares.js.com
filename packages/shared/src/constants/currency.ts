export const CURRENCY = "KWD" as const;
export type Currency = typeof CURRENCY;

export function formatPrice(amount: number, lang: "ar" | "en" = "en") {
  const locale = lang === "ar" ? "ar-KW" : "en-KW";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  }).format(amount);
}

export function formatPriceRange(min: number, max: number, lang: "ar" | "en" = "en") {
  if (min === max) return formatPrice(min, lang);
  return `${formatPrice(min, lang)} – ${formatPrice(max, lang)}`;
}
