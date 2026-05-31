"use client";

import { formatPrice } from "@capella/shared";
import type { CheckoutSummaryProps } from "../../types/checkout-view.types";

export function CheckoutSummary({ lang, dict, resolved, subtotal }: CheckoutSummaryProps) {
  return (
    <aside className="rounded-(--radius-lg) border border-(--hairline) bg-(--surface) p-5 shadow-(--shadow-1) sm:p-7 lg:sticky lg:top-[140px]">
      <span className="eyebrow !text-(--ink-3)">{lang === "ar" ? "المراجعة" : "Review"}</span>
      <div className={`mt-1 ${lang === "ar"
        ? "text-[22px] font-bold font-(--font-ar) text-(--ink)"
        : "text-[24px] italic font-(--font-display) text-(--ink)"}`}>
        {dict.checkout.review}
      </div>
      <div className="my-5 h-px bg-(--hairline)" />
      <ul className="m-0 grid list-none gap-3 p-0">
        {resolved.map((item) => (
          <li key={item.key} className="flex items-start justify-between gap-3 text-[14px]">
            <div className="min-w-0">
              <div className="truncate font-medium text-(--ink)">{item.title}</div>
              <div className="mt-0.5 text-[12px] text-(--ink-3)">
                {item.meta} · ×{item.qty}
              </div>
            </div>
            <div className="text-(--ink)">{formatPrice(item.unit * item.qty, lang)}</div>
          </li>
        ))}
      </ul>
      <div className="my-5 h-px bg-(--hairline)" />
      <div className="flex items-center justify-between py-1 text-[14px]">
        <span className="text-(--ink-2)">{dict.common.subtotal}</span>
        <span className="text-(--ink)">{formatPrice(subtotal, lang)}</span>
      </div>
      <div className="flex items-center justify-between py-1 text-[14px]">
        <span className="text-(--ink-2)">{dict.common.shipping}</span>
        <span className="text-[12px] text-(--ink-3)">{dict.common.calculatedAtCheckout}</span>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-(--hairline) pt-4">
        <span className="text-[15px] font-medium text-(--ink-2)">{dict.common.total}</span>
        <span className={`leading-none text-(--accent) ${lang === "ar"
          ? "text-[26px] font-bold font-(--font-ar)"
          : "text-[28px] italic font-(--font-display)"}`}>
          {formatPrice(subtotal, lang)}
        </span>
      </div>
    </aside>
  );
}
