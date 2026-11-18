"use client";

import { formatPrice } from "@capella/shared";
import type { CheckoutSummaryProps } from "../../types/checkout-view.types";
import { fillTemplate } from "@/lib/promo/promo-code";
import { PromoCodeBox } from "./promo-code-box";

export function CheckoutSummary({ lang, dict, resolved, subtotal, shippingAmountCents = 0, promo }: CheckoutSummaryProps) {
  const productsTotal = promo?.productsTotal ?? subtotal;
  const appliedCode = promo?.result?.status === "applied" ? promo.result.code : null;
  return (
    <aside className="rounded-lg border border-(--hairline) bg-surface p-5 shadow-(--shadow-1) sm:p-7 lg:sticky lg:top-35">
      <span className="eyebrow text-(--ink-3)!">{dict.checkout.reviewEyebrow}</span>
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
      {appliedCode ? (
        <div className="flex items-center justify-between py-1 text-sm">
          <span className="text-(--ink-2)">{fillTemplate(dict.promo.discountLine, { code: appliedCode })}</span>
          <span className="text-(--success)">{formatPrice(productsTotal - subtotal, lang)}</span>
        </div>
      ) : null}
      <div className="flex items-center justify-between py-1 text-sm">
        <span className="text-(--ink-2)">{dict.common.shipping}</span>
        <span className="text-ink">{shippingAmountCents == null ? dict.checkout.shippingPending : formatPrice(shippingAmountCents / 100, lang)}</span>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-(--hairline) pt-4">
        <span className="text-base font-medium text-(--ink-2)">{dict.common.total}</span>
        <span className={`leading-none text-accent ${lang === "ar"
          ? "text-2xl font-bold font-(family-name:--font-ar)"
          : "text-3xl font-(--font-display)"}`}>
          {shippingAmountCents == null ? "—" : formatPrice(productsTotal + shippingAmountCents / 100, lang)}
        </span>
      </div>
      {promo ? (
        <div className="mt-5 grid gap-2">
          <PromoCodeBox lang={lang} dict={dict} signedIn={promo.signedIn} loginHref={promo.loginHref} savedCode={promo.savedCode}
            promo={promo.result} preview={promo.preview} onSave={promo.saveCode} />
          {promo.notice ? <p role="status" className="m-0 text-sm text-(--error)">{promo.notice}</p> : null}
          {promo.onlineMinimum ? <p className="m-0 text-xs text-(--ink-3)">{dict.promo.onlineMinimum}</p> : null}
        </div>
      ) : null}
    </aside>
  );
}
