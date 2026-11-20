"use client";

import { formatPrice } from "@capella/shared";
import type { CheckoutSummaryProps } from "../../types/checkout-view.types";
import { PromoCodeBox } from "./promo-code-box";
import { PromoSavingsRows } from "./promo-savings-rows";

export function CheckoutSummary({ lang, dict, resolved, subtotal, quote, quoteState, promo }: CheckoutSummaryProps) {
  const productsTotal = promo?.productsTotal ?? subtotal;
  const applied = promo?.applied ?? null;
  const total = quoteState === "ready" && quote ? quote.total : productsTotal;
  // A free-delivery code: the fee the area would have charged, struck through.
  const waived = quoteState === "ready" && quote && quote.deliveryFee === 0 && (quote.deliveryFeeWaived ?? 0) > 0 ? quote.deliveryFeeWaived! : 0;
  return (
    <aside className="rounded-lg border border-(--hairline) bg-surface p-5 shadow-(--shadow-1) sm:p-7 lg:sticky lg:top-35">
      <span className="eyebrow text-(--ink-3)!">{dict.checkout.reviewEyebrow}</span>
      <div className={`mt-1 ${lang === "ar"
        ? "text-2xl font-bold font-(family-name:--font-ar) text-ink"
        : "text-2xl font-extrabold text-ink"}`}>
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
            <div className="text-end">
              {item.lineTotal !== undefined && Math.abs(item.lineTotal - item.unit * item.qty) >= 0.0005 ? (
                <del className="block text-xs text-(--ink-3)">{formatPrice(item.unit * item.qty, lang)}</del>
              ) : null}
              <span className="text-ink">{formatPrice(item.lineTotal ?? item.unit * item.qty, lang)}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="my-5 h-px bg-(--hairline)" />
      <PromoSavingsRows lang={lang} dict={dict} subtotal={subtotal} productsTotal={productsTotal} applied={applied}
        rowClassName="flex items-center justify-between py-1 text-sm" />
      <div className="flex items-center justify-between gap-3 py-1 text-sm">
        <span className="text-(--ink-2)">{dict.common.shipping}</span>
        <span data-testid="checkout-delivery" className="text-end">
          {quoteState === "ready" && quote ? (
            waived > 0 ? (
              <span className="flex items-center gap-2">
                <del className="text-(--ink-3)">{formatPrice(waived, lang)}</del>
                <span className="font-semibold text-(--success)">{dict.promo.freeDeliveryWithCode}</span>
              </span>
            ) : quote.deliveryFee === 0
              ? <span className="font-semibold text-(--success)">{dict.common.freeDelivery}</span>
              : <span className="text-ink">{formatPrice(quote.deliveryFee, lang)}</span>
          ) : quoteState === "loading" ? (
            <span className="text-(--ink-3)">{dict.common.loading}</span>
          ) : quoteState === "error" ? (
            <span className="text-(--danger)">{dict.checkout.deliveryQuoteFailed}</span>
          ) : (
            <span className="text-(--ink-3)">{dict.checkout.chooseArea}</span>
          )}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-(--hairline) pt-4">
        <span className="text-base font-medium text-(--ink-2)">{dict.common.total}</span>
        <span className={`leading-none text-accent ${lang === "ar"
          ? "text-2xl font-bold font-(family-name:--font-ar)"
          : "text-3xl font-extrabold"}`} data-testid="checkout-total">
          {formatPrice(total, lang)}
        </span>
      </div>
      {promo ? (
        <div className="mt-5 grid gap-2">
          <PromoCodeBox lang={lang} dict={dict} signedIn={promo.signedIn} loginHref={promo.loginHref} savedCode={promo.savedCode}
            promo={promo.result} preview={promo.preview} onSave={promo.saveCode}
            confirmation={promo.confirmation} onConfirm={promo.confirm} onDecline={promo.decline} />
          {promo.notice ? <p role="status" className="m-0 text-sm text-(--error)">{promo.notice}</p> : null}
        </div>
      ) : null}
    </aside>
  );
}
