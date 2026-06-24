"use client";

import { formatPrice } from "@capella/shared";
import type { CheckoutSummaryProps } from "../../types/checkout-view.types";

export function CheckoutSummary({ lang, dict, resolved, subtotal }: CheckoutSummaryProps) {
  return (
    <aside className="rounded-lg border border-(--hairline) bg-surface p-5 shadow-(--shadow-1) sm:p-7 lg:sticky lg:top-35">
      <span className="eyebrow text-(--ink-3)!">{lang === "ar" ? "المراجعة" : "Review"}</span>
      <div className={`mt-1 ${lang === "ar"
        ? "text-2xl font-bold font-(family-name:--font-ar) text-ink"
        : "text-2xl font-(--font-display) text-ink"}`}>
        {dict.checkout.review}
      </div>
      <div className="my-5 h-px bg-(--hairline)" />
      <ul className="m-0 grid list-none gap-3 p-0">
        {resolved.map((item) => (
          <li key={item.key} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium text-ink">{item.title}</div>
              <div className="mt-0.5 text-xs text-(--ink-3)">
                {item.meta} · ×{item.qty}
              </div>
            </div>
            <div className="text-ink">{formatPrice(item.unit * item.qty, lang)}</div>
          </li>
        ))}
      </ul>
      <div className="my-5 h-px bg-(--hairline)" />
      <div className="flex items-center justify-between py-1 text-sm">
        <span className="text-(--ink-2)">{dict.common.subtotal}</span>
        <span className="text-ink">{formatPrice(subtotal, lang)}</span>
      </div>
      <div className="flex items-center justify-between py-1 text-sm">
        <span className="text-(--ink-2)">{dict.common.shipping}</span>
        <span className="text-xs text-(--ink-3)">{dict.common.calculatedAtCheckout}</span>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-(--hairline) pt-4">
        <span className="text-base font-medium text-(--ink-2)">{dict.common.total}</span>
        <span className={`leading-none text-accent ${lang === "ar"
          ? "text-2xl font-bold font-(family-name:--font-ar)"
          : "text-3xl font-(--font-display)"}`}>
          {formatPrice(subtotal, lang)}
        </span>
      </div>
    </aside>
  );
}
